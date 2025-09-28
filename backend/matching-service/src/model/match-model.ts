import { PrismaClient } from "../generated/prisma/index.js";
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
  ttlMs?: number;
};

export type MatchResult =
  | { status: "matched"; roomId: string; partnerId: string }
  | { status: "queued"; expiresAt: Date }
  | { status: "cancelled" }
  | { status: "not_found" }
  | { status: "already_matched"; roomId: string; partnerId: string };

export async function enqueueOrMatch(input: MatchInput): Promise<MatchResult> {
  const { userId, language, difficulty, topic, ttlMs = DEFAULT_TTL_MS } = input;
  const expiresAt = new Date(Date.now() + ttlMs);

  return await prisma.$transaction(async (tx) => {
    await tx.matchTicket.updateMany({
      where: {
        status: MATCH_STATUS.QUEUED,
        expiresAt: { lt: new Date() },
      },
      data: { status: MATCH_STATUS.EXPIRED },
    });

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

    const candidates = await tx.$queryRaw<{ id: string; userId: string }[]>`
      SELECT "id", "userId"
      FROM "match"."matchticket"
      WHERE "language" = ${language}
        AND "difficulty" = ${difficulty}
        AND "topic" = ${topic}
        AND "status" = 'QUEUED'
        AND "expiresAt" > now()
        AND "userId" <> ${userId}
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;

    if (candidates.length > 0) {
      const partner = candidates[0];
      const roomId = `room_${nanoid(16)}`;

      await tx.matchTicket.upsert({
        where: { userId },
        create: {
          userId,
          language,
          difficulty,
          topic,
          status: MATCH_STATUS.MATCHED,
          partnerId: partner.userId,
          roomId,
          expiresAt,
        },
        update: {
          status: MATCH_STATUS.MATCHED,
          partnerId: partner.userId,
          roomId,
          expiresAt,
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

      return { status: "matched", roomId, partnerId: partner.userId };
    }

    const queued = await tx.matchTicket.upsert({
      where: { userId },
      create: {
        userId,
        language,
        difficulty,
        topic,
        status: MATCH_STATUS.QUEUED,
        expiresAt,
      },
      update: {
        language,
        difficulty,
        topic,
        status: MATCH_STATUS.QUEUED,
        expiresAt,
      },
      select: { expiresAt: true },
    });

    return { status: "queued", expiresAt: queued.expiresAt };
  }, { timeout: 8000 });
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
