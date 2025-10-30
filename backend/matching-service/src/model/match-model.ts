import axios from "axios";
import { PrismaClient, Prisma } from "../generated/prisma/index.js";
import { nanoid } from "nanoid";

//=========================== PRISMA ===========================
const prisma = new PrismaClient();

export async function initConnection() {
  await prisma.$connect();
}

//=========================== CONSTANT & ENUMS ===========================
const DEFAULT_TTL_MS = 30 * 1000;

export const MATCH_STATUS = {
  QUEUED: "QUEUED",
  MATCHED: "MATCHED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;

export type MatchStatus = typeof MATCH_STATUS[keyof typeof MATCH_STATUS];

export type MatchInput = {
  userId: string;
  languageIn?: string | string[] | undefined;
  difficultyIn?: string | string[] | undefined;
  topicIn?: string | string[] | undefined;
  ttlMs?: number | undefined;
};

export type MatchResult =
  | {
      status: "matched";
      roomId: string;
      partnerId: string;
      startedTime?: Date;
      expiresAt?: Date;
      language?: string;
      difficulty?: string;
      topic?: string;
    }
  | { status: "queued"; expiresAt: Date; startedTime?: Date }
  | { status: "cancelled"; startedTime?: Date }
  | { status: "not_found"; startedTime?: Date }
  | {
      status: "already_matched";
      roomId: string;
      partnerId: string;
      startedTime?: Date;
      expiresAt?: Date;
    };

//=========================== CORE ===========================
export async function enqueueOrMatch(input: MatchInput): Promise<MatchResult> {
  const { userId, ttlMs = DEFAULT_TTL_MS, languageIn, difficultyIn, topicIn } = input;

  const langSet = sanitizeSet(languageIn);
  const diffSet = sanitizeSet(difficultyIn);
  const topicSet = sanitizeSet(topicIn);

  const expiresAt = new Date(Date.now() + ttlMs);

  return await prisma.$transaction(
    async (tx) => {
      await tx.matchTicket.deleteMany({
        where: { status: MATCH_STATUS.QUEUED, expiresAt: { lt: new Date() } },
      });

      const existing = await tx.matchTicket.findUnique({ where: { userId } });
      if (existing && existing.status === MATCH_STATUS.QUEUED && existing.expiresAt < new Date()) {
        await tx.matchTicket.delete({ where: { userId } });
      }

      const filters: Prisma.Sql[] = [
        Prisma.sql`"status" = 'QUEUED'`,
        Prisma.sql`"expiresAt" > now()`,
        Prisma.sql`"userId" <> ${userId}`,
      ];

      const anyFilterProvided = langSet.length || diffSet.length || topicSet.length;
      if (anyFilterProvided) {
        const langClause = langSet.length
          ? Prisma.sql`("languagePref"   && ARRAY[${Prisma.join(langSet)}]::text[])`
          : Prisma.sql`TRUE`;
        const diffClause = diffSet.length
          ? Prisma.sql`("difficultyPref" && ARRAY[${Prisma.join(diffSet)}]::text[])`
          : Prisma.sql`TRUE`;
        const topicClause = topicSet.length
          ? Prisma.sql`("topicPref"      && ARRAY[${Prisma.join(topicSet)}]::text[])`
          : Prisma.sql`TRUE`;
        filters.push(Prisma.sql`(${langClause} OR ${diffClause} OR ${topicClause})`);
      }

      const whereSql = Prisma.sql`WHERE ${Prisma.join(filters, " AND ")}`;

      const candidates = await tx.$queryRaw<
        Array<{
          id: string;
          userId: string;
          languagePref: string[] | null;
          difficultyPref: string[] | null;
          topicPref: string[] | null;
        }>
      >(Prisma.sql`
        SELECT "id","userId","languagePref","difficultyPref","topicPref"
        FROM "matchservice"."matchticket"
        ${whereSql}
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 25
      `);

      const partner =
        candidates.find(
          (c) =>
            hasOverlap(langSet, c.languagePref) ||
            hasOverlap(diffSet, c.difficultyPref) ||
            hasOverlap(topicSet, c.topicPref)
        ) ?? null;

      // 4) If we found a partner, write durable record and DELETE both queue tickets
      if (partner) {
        const roomId = getRoomId();
        const overlap = computePreferenceOverlap(
          { languagePref: langSet, difficultyPref: diffSet, topicPref: topicSet },
          {
            languagePref: partner.languagePref,
            difficultyPref: partner.difficultyPref,
            topicPref: partner.topicPref,
          }
        );

        const chosenLanguage = pickOne(overlap.language) ?? "unspecified";
        const chosenDifficulty = pickOne(overlap.difficulty) ?? "unspecified";
        const chosenTopic = pickOne(overlap.topic) ?? "unspecified";
        const questionId = getQuestionId(chosenTopic, chosenLanguage, chosenDifficulty);

        console.log("[match] chosen overlap", {
          userId,
          partnerId: partner.userId,
          language: chosenLanguage,
          difficulty: chosenDifficulty,
          topic: chosenTopic,
        });

        await writeMatchedUsers(tx, {
          userAId: userId,
          userBId: partner.userId,
          roomId,
          language: chosenLanguage,
          difficulty: chosenDifficulty,
          topic: chosenTopic,
          questionId,
          matchedAt: new Date(),
        });

        await tx.matchTicket.deleteMany({
          where: { userId: { in: [userId, partner.userId] } },
        });

        return {
          status: "matched",
          roomId,
          partnerId: partner.userId,
          startedTime: new Date(),
          expiresAt,
          language: chosenLanguage,
          difficulty: chosenDifficulty,
          topic: chosenTopic,
        };
      }

      const queued = await tx.matchTicket.upsert({
        where: { userId },
        create: {
          userId,
          status: MATCH_STATUS.QUEUED,
          expiresAt,
          ...(langSet.length ? { languagePref: langSet } : {}),
          ...(diffSet.length ? { difficultyPref: diffSet } : {}),
          ...(topicSet.length ? { topicPref: topicSet } : {}),
        },
        update: {
          status: MATCH_STATUS.QUEUED,
          expiresAt,
          ...(langSet.length ? { languagePref: { set: langSet } } : {}),
          ...(diffSet.length ? { difficultyPref: { set: diffSet } } : {}),
          ...(topicSet.length ? { topicPref: { set: topicSet } } : {}),
        },
        select: { expiresAt: true },
      });

      return { status: "queued", expiresAt: queued.expiresAt, startedTime: new Date() };
    },
    { timeout: 8000 }
  );
}

export async function getStatus(userId: string): Promise<MatchResult> {
  const ticket = await prisma.matchTicket.findUnique({
    where: { userId },
    select: { status: true, expiresAt: true, createdAt: true },
  });

  if (!ticket) return { status: "not_found", startedTime: new Date() };

  const startedTime = ticket.createdAt;

  if (ticket.status === MATCH_STATUS.QUEUED && ticket.expiresAt <= new Date()) {
    await prisma.matchTicket.delete({ where: { userId } });
    return { status: "not_found", startedTime };
  }

  return { status: "queued", expiresAt: ticket.expiresAt, startedTime };
}

export async function cancel(userId: string): Promise<MatchResult> {
  const t = await prisma.matchTicket.findUnique({ where: { userId } });
  if (!t) return { status: "not_found" };

  await prisma.matchTicket.delete({ where: { userId } });
  return { status: "cancelled" };
}

//=========================== PRIVATE ===========================
function getRoomId(): string {
  return `room_${nanoid(16)}`;
}

type Prefs = {
  languagePref?: string[] | null;
  difficultyPref?: string[] | null;
  topicPref?: string[] | null;
};

type PreferenceOverlap = {
  language: string[];
  difficulty: string[];
  topic: string[];
};

const wildcardIntersect = (a?: string[] | null, b?: string[] | null): string[] => {
  const A = toNormalizedSet(a);
  const B = toNormalizedSet(b);
  if (A.length === 0 && B.length === 0) return [];
  if (A.length === 0) return B;
  if (B.length === 0) return A;
  const bSet = new Set(B);
  return A.filter((x) => bSet.has(x));
};

function computePreferenceOverlap(self: Prefs, other: Prefs): PreferenceOverlap {
  return {
    language: wildcardIntersect(self.languagePref, other.languagePref),
    difficulty: wildcardIntersect(self.difficultyPref, other.difficultyPref),
    topic: wildcardIntersect(self.topicPref, other.topicPref),
  };
}

const pickOne = (xs?: readonly string[] | null): string | null => {
  if (!xs || xs.length === 0) return null;
  const idx = Math.floor(Math.random() * xs.length);
  return xs[idx] ?? null;
};

function toArray<T>(value?: T | T[]): T[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (value != null) {
    return [value];
  }
  return [];
}

function normalize(value: string): string {
  return value.trim();
}

function toNormalizedSet(values?: string[] | null): string[] {
  if (!values) return [];
  const cleanedValues = values.map(normalize).filter(Boolean);
  return Array.from(new Set(cleanedValues));
}

function sanitizeSet(values?: string | string[]): string[] {
  const list = toArray(values);
  const normalized = list.map((item) => normalize(String(item))).filter(Boolean);
  return Array.from(new Set(normalized));
}

function hasOverlap(a: string[], b?: string[] | null): boolean {
  const normalizedB = (b ?? []).map(normalize);
  if (a.length === 0 || normalizedB.length === 0) return true; // wildcard behavior
  const bSet = new Set(normalizedB);
  return a.some((item) => bSet.has(normalize(item)));
}

export async function getQuestionId(
  topic?: string,
  language?: string,
  difficulty?: string
): Promise<string> {
  const baseURL = "http://question:3002";
  const params = new URLSearchParams();

  if (difficulty) params.append("difficulty", difficulty);
  if (topic) params.append("topicNames", topic);
  // if (language) params.append("language", language);
  console.log("PARAMS: " + params)
  try {
    const response = await axios.get(`${baseURL}/api/questions`, { params });
    console.log("response: " + response)
    const questions = response.data;
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("No question found for the given filters");
    }

    // Return the first matching question's ID (or choose random if needed)
    console.log("Got QuestionID");
    return String(questions[0].id);
  } catch (err: any) {
    console.error("Error fetching question ID:", err.message);
    throw err;
  }
}

export async function writeMatchedUsers(
  tx: Prisma.TransactionClient | PrismaClient,
  args: {
    userAId: string;
    userBId: string;
    roomId: string;
    language: string;
    difficulty: string;
    topic: string;
    questionId?: string | null;
    matchedAt?: Date;
  }
) {
  const { userAId, userBId, roomId, language, difficulty, topic, questionId = null, matchedAt } =
    args;

  return tx.matchedUsers.upsert({
    where: { roomId },
    create: {
      userAId,
      userBId,
      roomId,
      language,
      difficulty,
      topic,
      questionId,
      ...(matchedAt ? { matchedAt } : {}),
    },
    update: {
      userAId,
      userBId,
      language,
      difficulty,
      topic,
      questionId,
      ...(matchedAt ? { matchedAt } : {}),
    },
  });
}
