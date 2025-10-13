import { PrismaClient, Prisma } from "../generated/prisma/index.js";
import { nanoid } from "nanoid";

//=========================== PRISMA ===========================
const prisma = new PrismaClient();

export async function initConnection() {
  await prisma.$connect();
}

//=========================== CONSTANT & ENUMS ===========================
const DEFAULT_TTL_MS = 2 * 60 * 1000;

export const MATCH_STATUS = {
  QUEUED: "QUEUED",
  MATCHED: "MATCHED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;

export type MatchStatus = typeof MATCH_STATUS[keyof typeof MATCH_STATUS];

export type MatchInput = {
  userId: string;
  languageIn: string[];
  difficultyIn: string[];
  topicIn: string[];
  ttlMs?: number;
};

export type MatchResult =
  | { status: "matched"; roomId: string; partnerId: string }
  | { status: "queued"; expiresAt: Date }
  | { status: "cancelled" }
  | { status: "not_found" }
  | { status: "already_matched"; roomId: string; partnerId: string };

//=========================== CORE ===========================
export async function enqueueOrMatch(input: MatchInput): Promise<MatchResult> {
  const { userId, ttlMs = DEFAULT_TTL_MS, languageIn, difficultyIn, topicIn } = input;

  const langSet = sanitizeSet(languageIn);
  const diffSet = sanitizeSet(difficultyIn);
  const topicSet = sanitizeSet(topicIn);

  const expiresAt = new Date(Date.now() + ttlMs);

  return await prisma.$transaction(async (tx) => {
    await tx.matchTicket.updateMany({
      where: { status: MATCH_STATUS.QUEUED, expiresAt: { lt: new Date() } },
      data: { status: MATCH_STATUS.EXPIRED },
    });

    const existing = await tx.matchTicket.findUnique({ where: { userId } });
    if (existing?.status === MATCH_STATUS.MATCHED && existing.roomId && existing.partnerId) {
      return {
        status: "already_matched",
        roomId: existing.roomId,
        partnerId: existing.partnerId,
      };
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

    const candidates = await tx.$queryRaw<Array<{
      id: string;
      userId: string;
      languagePref: string[] | null;
      difficultyPref: string[] | null;
      topicPref: string[] | null;
    }>>(Prisma.sql`
      SELECT "id","userId","languagePref","difficultyPref","topicPref"
      FROM "matchservice"."matchticket"
      ${whereSql}
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 25
    `);

    const partner = candidates.find(c =>
      hasOverlap(langSet,  c.languagePref) ||
      hasOverlap(diffSet,  c.difficultyPref) ||
      hasOverlap(topicSet, c.topicPref)
    );

    if (partner) {
      const roomId = getRoomId();
      const overlap = computePreferenceOverlap(
        { languagePref: langSet, difficultyPref: diffSet, topicPref: topicSet },
        { languagePref: partner.languagePref, difficultyPref: partner.difficultyPref, topicPref: partner.topicPref }
      );

      const chosenLanguage  = pickOne(overlap.language);
      const chosenDifficulty = pickOne(overlap.difficulty);
      const chosenTopic     = pickOne(overlap.topic);

      console.log("[match] chosen overlap", {
        userId,
        partnerId: partner.userId,
        language: chosenLanguage,
        difficulty: chosenDifficulty,
        topic: chosenTopic,
      });

      await tx.matchTicket.upsert({
        where: { userId },
        create: {
          userId,
          status: MATCH_STATUS.MATCHED,
          partnerId: partner.userId,
          roomId,
          expiresAt,
          ...(langSet.length ? { languagePref:   langSet } : {}),
          ...(diffSet.length ? { difficultyPref: diffSet } : {}),
          ...(topicSet.length ? { topicPref:      topicSet } : {}),
        },
        update: {
          status: MATCH_STATUS.MATCHED,
          partnerId: partner.userId,
          roomId,
          expiresAt,
          ...(langSet.length ? { languagePref:   { set: langSet } } : {}),
          ...(diffSet.length ? { difficultyPref: { set: diffSet } } : {}),
          ...(topicSet.length ? { topicPref:      { set: topicSet } } : {}),
        },
      });

      await tx.matchTicket.update({
        where: { id: partner.id },
        data: {
          status: MATCH_STATUS.MATCHED,
          partnerId: userId,
          roomId,
          expiresAt,
        },
      });

      return { status: "matched", roomId, partnerId: partner.userId, language: chosenLanguage, topic: chosenTopic, difficulty: chosenDifficulty };
    }

    const queued = await tx.matchTicket.upsert({
      where: { userId },
      create: {
        userId,
        status: MATCH_STATUS.QUEUED,
        expiresAt,
        ...(langSet.length ? { languagePref:   langSet } : {}),
        ...(diffSet.length ? { difficultyPref: diffSet } : {}),
        ...(topicSet.length ? { topicPref:      topicSet } : {}),
      },
      update: {
        status: MATCH_STATUS.QUEUED,
        expiresAt,
        ...(langSet.length ? { languagePref:   { set: langSet } } : {}),
        ...(diffSet.length ? { difficultyPref: { set: diffSet } } : {}),
        ...(topicSet.length ? { topicPref:      { set: topicSet } } : {}),
      },
      select: { expiresAt: true },
    });

    return { status: "queued", expiresAt: queued.expiresAt };
  }, { timeout: 8000 });
}



export async function getStatus(userId: string): Promise<MatchResult> {
  const ticket = await prisma.matchTicket.findUnique({
    where: { userId },
    select: { status: true, roomId: true, partnerId: true, expiresAt: true },
  });

  if (!ticket) 
    return { status: "not_found" };

  switch (ticket.status) {
    case MATCH_STATUS.CANCELLED:
      return { status: "cancelled" };

    case MATCH_STATUS.MATCHED:
      if (ticket.roomId && ticket.partnerId) {
        return { status: "matched", roomId: ticket.roomId, partnerId: ticket.partnerId };
      }
      return { status: "not_found" };

    case MATCH_STATUS.QUEUED: {
      const { count } = await prisma.matchTicket.updateMany({
        where: {
          userId,
          status: MATCH_STATUS.QUEUED,
          expiresAt: { lt: new Date() },
        },
        data: { status: MATCH_STATUS.EXPIRED },
      });

      if (count > 0) {
        return { status: "not_found" };
      }

      return { status: "queued", expiresAt: ticket.expiresAt };
    }

    case MATCH_STATUS.EXPIRED:
    default:
      return { status: "not_found" };
  }
}


export async function cancel(userId: string): Promise<MatchResult> {
  const t = await prisma.matchTicket.findUnique({ where: { userId } });

  if (!t) 
    return { status: "not_found" };
  if (t.status === MATCH_STATUS.CANCELLED) 
    return { status: "cancelled" };
  await prisma.matchTicket.update({
    where: { userId },
    data: { status: MATCH_STATUS.CANCELLED },
  });
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
  return A.filter(x => bSet.has(x));
};

function computePreferenceOverlap(self: Prefs, other: Prefs): PreferenceOverlap {
  return {
    language:  wildcardIntersect(self.languagePref,  other.languagePref),
    difficulty:wildcardIntersect(self.difficultyPref,other.difficultyPref),
    topic:     wildcardIntersect(self.topicPref,     other.topicPref),
  };
}

const pickOne = (xs?: readonly string[] | null): string | null => {
  if (!xs || xs.length === 0) return null;
  const idx = Math.floor(Math.random() * xs.length);
  return xs[idx] ?? null; // coalesce any undefined to null
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
  return value.trim().toLowerCase();
}

function toNormalizedSet(values?: string[] | null): string[] {
  if (!values) return [];

  const cleanedValues = values.map(normalize).filter(Boolean);
  return Array.from(new Set(cleanedValues));
}

function sanitizeSet(values?: string | string[]): string[] {
  const list = toArray(values);
  const normalized = list
    .map((item) => normalize(String(item)))
    .filter(Boolean);
  return Array.from(new Set(normalized));
}

function hasOverlap(a: string[], b?: string[] | null): boolean {
  const normalizedB = (b ?? []).map(normalize);

  if (a.length === 0 || normalizedB.length === 0) {
    return true;
  }

  const bSet = new Set(normalizedB);
  return a.some((item) => bSet.has(normalize(item)));
}
