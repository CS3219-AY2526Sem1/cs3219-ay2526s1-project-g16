import { PrismaClient, Prisma } from "../generated/prisma/index.js";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

export async function initConnection() {
  await prisma.$connect();
}

export const MATCH_STATUS = {
  QUEUED: "QUEUED",
  MATCHED: "MATCHED",
  CANCELLED: "CANCELLED",
  EXPIRED: "EXPIRED",
} as const;

export type MatchStatus = typeof MATCH_STATUS[keyof typeof MATCH_STATUS];

// How long tickets live (mimics Redis TTL)
const DEFAULT_TTL_MS = 2 * 60 * 1000; // 2 minutes

export type MatchInput = {
  userId: string;

  language: string;
  difficulty: string;
  topic: string;

  languageIn?: string | string[] | undefined;
  difficultyIn?: string | string[] | undefined;
  topicIn?: string | string[] | undefined;

  ttlMs?: number | undefined;
};

export type MatchResult =
  | { status: "matched"; roomId: string; partnerId: string }
  | { status: "queued"; expiresAt: Date }
  | { status: "cancelled" }
  | { status: "not_found" }
  | { status: "already_matched"; roomId: string; partnerId: string };

// ------------------------ helpers ------------------------

const toArray = <T>(v?: T | T[]) =>
  Array.isArray(v) ? v : v != null ? [v] : [];

const norm = (s: string) => s.trim().toLowerCase();

const sanitizeSet = (xs?: string | string[]) =>
  Array.from(new Set(toArray(xs).map((x) => norm(String(x))))).filter(Boolean);

// ------------------------ core ------------------------

export async function enqueueOrMatch(input: MatchInput): Promise<MatchResult> {
  const {
    userId,
    language,
    difficulty,
    topic,
    ttlMs = DEFAULT_TTL_MS,
    languageIn,
    difficultyIn,
    topicIn,
  } = input;

  // normalize single choices
  const langOne = norm(language);
  const diffOne = norm(difficulty);
  const topicOne = norm(topic);

  // normalize preference sets (empty = no filter)
  const langSet = sanitizeSet(languageIn);
  const diffSet = sanitizeSet(difficultyIn);
  const topicSet = sanitizeSet(topicIn);

  const expiresAt = new Date(Date.now() + ttlMs);

  return await prisma.$transaction(
    async (tx) => {
      // expire old tickets
      await tx.matchTicket.updateMany({
        where: { status: MATCH_STATUS.QUEUED, expiresAt: { lt: new Date() } },
        data: { status: MATCH_STATUS.EXPIRED },
      });

      // short-circuit if already matched
      const existing = await tx.matchTicket.findUnique({ where: { userId } });
      if (
        existing?.status === MATCH_STATUS.MATCHED &&
        existing.roomId &&
        existing.partnerId
      ) {
        return {
          status: "already_matched",
          roomId: existing.roomId,
          partnerId: existing.partnerId,
        };
      }

      // Build WHERE with optional filters using Prisma.sql
      let whereSql = Prisma.sql`
        WHERE "status" = 'QUEUED'
          AND "expiresAt" > now()
          AND "userId" <> ${userId}
      `;
      if (langSet.length) {
        whereSql = Prisma.sql`${whereSql} AND lower("language") IN (${Prisma.join(
          langSet
        )})`;
      }
      if (diffSet.length) {
        whereSql = Prisma.sql`${whereSql} AND lower("difficulty") IN (${Prisma.join(
          diffSet
        )})`;
      }
      if (topicSet.length) {
        whereSql = Prisma.sql`${whereSql} AND lower("topic") IN (${Prisma.join(
          topicSet
        )})`;
      }

      const candidates = await tx.$queryRaw<
        Array<{
          id: string;
          userId: string;
          language: string;
          difficulty: string;
          topic: string;
          languagePref: string[] | null;
          difficultyPref: string[] | null;
          topicPref: string[] | null;
        }>
      >(Prisma.sql`
        SELECT
          "id",
          "userId",
          lower("language")   AS "language",
          lower("difficulty") AS "difficulty",
          lower("topic")      AS "topic",
          "languagePref",
          "difficultyPref",
          "topicPref"
        FROM "match"."matchticket"
        ${whereSql}
        ORDER BY "createdAt" ASC
        FOR UPDATE SKIP LOCKED
        LIMIT 25
      `);

      // find first mutually compatible (if partner has prefs). If they don't, one-way is fine.
      const partner = candidates.find((c) => {
        const lp = (c.languagePref ?? []).map(norm);
        const dp = (c.difficultyPref ?? []).map(norm);
        const tp = (c.topicPref ?? []).map(norm);

        const partnerHasPrefs = lp.length || dp.length || tp.length;
        if (!partnerHasPrefs) return true; // they accept anything

        const langOk = lp.length === 0 || lp.includes(langOne);
        const diffOk = dp.length === 0 || dp.includes(diffOne);
        const topicOk = tp.length === 0 || tp.includes(topicOne);
        return langOk && diffOk && topicOk;
      });

      if (partner) {
        const roomId = getRoomId();

        // upsert current user as MATCHED
        await tx.matchTicket.upsert({
          where: { userId },
          create: {
            userId,
            language: langOne,
            difficulty: diffOne,
            topic: topicOne,
            status: MATCH_STATUS.MATCHED,
            partnerId: partner.userId,
            roomId,
            expiresAt,
            // ⬇️ pass arrays only when non-empty; otherwise omit
            ...(langSet.length ? { languagePref: langSet } : {}),
            ...(diffSet.length ? { difficultyPref: diffSet } : {}),
            ...(topicSet.length ? { topicPref: topicSet } : {}),
          },
          update: {
            status: MATCH_STATUS.MATCHED,
            partnerId: partner.userId,
            roomId,
            expiresAt,
            language: langOne,
            difficulty: diffOne,
            topic: topicOne,
            // ⬇️ on update, use { set: ... } for scalar list fields
            ...(langSet.length ? { languagePref: { set: langSet } } : {}),
            ...(diffSet.length ? { difficultyPref: { set: diffSet } } : {}),
            ...(topicSet.length ? { topicPref: { set: topicSet } } : {}),
          },
        });

        // mark partner matched
        await tx.matchTicket.update({
          where: { id: partner.id },
          data: {
            status: MATCH_STATUS.MATCHED,
            partnerId: userId,
            roomId,
            expiresAt,
          },
        });

        return { status: "matched", roomId, partnerId: partner.userId };
      }

      // queue (store both single choices + preference sets so future mutual checks work)
      const queued = await tx.matchTicket.upsert({
        where: { userId },
        create: {
          userId,
          language: langOne,
          difficulty: diffOne,
          topic: topicOne,
          status: MATCH_STATUS.QUEUED,
          expiresAt,
          ...(langSet.length ? { languagePref: langSet } : {}),
          ...(diffSet.length ? { difficultyPref: diffSet } : {}),
          ...(topicSet.length ? { topicPref: topicSet } : {}),
        },
        update: {
          language: langOne,
          difficulty: diffOne,
          topic: topicOne,
          status: MATCH_STATUS.QUEUED,
          expiresAt,
          ...(langSet.length ? { languagePref: { set: langSet } } : {}),
          ...(diffSet.length ? { difficultyPref: { set: diffSet } } : {}),
          ...(topicSet.length ? { topicPref: { set: topicSet } } : {}),
        },
        select: { expiresAt: true },
      });

      return { status: "queued", expiresAt: queued.expiresAt };
    },
    { timeout: 8000 }
  );
}

export async function getStatus(userId: string): Promise<MatchResult> {
  const t = await prisma.matchTicket.findUnique({ where: { userId } });
  if (!t) return { status: "not_found" };
  if (t.status === MATCH_STATUS.CANCELLED) return { status: "cancelled" };
  if (t.status === MATCH_STATUS.MATCHED && t.roomId && t.partnerId) {
    return { status: "matched", roomId: t.roomId, partnerId: t.partnerId };
  }
  if (t.status === MATCH_STATUS.QUEUED) {
    if (t.expiresAt < new Date()) {
      await prisma.matchTicket.update({
        where: { userId },
        data: { status: MATCH_STATUS.EXPIRED },
      });
      return { status: "not_found" };
    }
    return { status: "queued", expiresAt: t.expiresAt };
  }
  return { status: "not_found" };
}

export async function cancel(userId: string): Promise<MatchResult> {
  const t = await prisma.matchTicket.findUnique({ where: { userId } });
  if (!t) return { status: "not_found" };
  if (t.status === MATCH_STATUS.CANCELLED) return { status: "cancelled" };

  await prisma.matchTicket.update({
    where: { userId },
    data: { status: MATCH_STATUS.CANCELLED },
  });
  return { status: "cancelled" };
}

// Private Functions
function getRoomId(): string {
  return `room_${nanoid(16)}`;
}
