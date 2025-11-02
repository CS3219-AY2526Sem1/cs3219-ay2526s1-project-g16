import { PrismaClient, SessionStatus } from "../generated/prisma/index.js";
import * as Y from 'yjs';

export const prisma = new PrismaClient(); // do i need to dup

export const initConnection = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log("Prisma connected");
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    process.exit(1); 
  }
};

// Returns status if he is in active session
export async function findMyActiveSession(userId: string) {
  const row = await prisma.participant.findFirst({
    where: { userId, leftAt: null, session: { status: "ACTIVE" } },
    select: { session: true },
  });
  return row?.session ?? null;
}

// ====== Session ops =====
const DEFAULT_TTL_MIN = 90;

export const createSession = async (
  roomId: string,
  topic: string,
  difficulty: string,
  questionId?: string | null,
  expiresAt?: Date | null
) => {
  const exp = expiresAt ?? new Date(Date.now() + DEFAULT_TTL_MIN * 60_000);
  return await prisma.collabSession.create({
    data: {
      id: roomId,
      topic,
      difficulty,
      questionId: questionId ?? null,
      expiresAt: exp ?? null,
    },
    include: { participants: true },
  });
};

export const endSession = async (sessionId: string) => {
  return prisma.$transaction(async (tx) => {
    const ended = await tx.collabSession.update({ where: { id: sessionId }, data: { status: "ENDED" } });
    await tx.participant.updateMany({ where: { sessionId, leftAt: null }, data: { leftAt: new Date() } });
    return ended;
  });
};

export const getSession = async (sessionId: string) => {
  return await prisma.collabSession.findUnique({
    where: { id: sessionId },
    include: { participants: true }
  });
};

// ====== Session sweeper ===== 
export async function sweepExpiredSessions() {
  const now = new Date();
  return prisma.$transaction(async (tx) => {
    const { count } = await tx.collabSession.updateMany({
      where: { status: "ACTIVE", expiresAt: {lt: now}  }, 
      data: { status: "TIMED_OUT" },
    });

    await tx.participant.updateMany({
      where: { leftAt: null, session: { status: "TIMED_OUT" } },
      data: { leftAt: new Date() },
    });

    return { expired: count };
  });
}

// ====== DB guards: run once at startup ======
export async function ensureDbGuards() {
  // 1 active participant per user across all sessions
  await prisma.$executeRawUnsafe(`
    CREATE UNIQUE INDEX IF NOT EXISTS uniq_active_participant_per_user
    ON collab.participants ("userId")
    WHERE "leftAt" IS NULL
  `);

  // Helpful index for counting active participants per room
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS idx_participants_active_by_session
    ON collab.participants ("sessionId")
    WHERE "leftAt" IS NULL
  `);
}


// ====== YDoc seeder - not implemented yet; ignore for now =====
export async function seedDocIfEmpty(sessionId: string, seed: string) {
  // If already exists, bail
  const existing = await prisma.yDoc.findUnique({ where: { name: sessionId } });
  if (existing) return;

  // Build a Y state with the seed
  const doc = new Y.Doc();
  doc.getText('code').insert(0, seed);
  const state = Y.encodeStateAsUpdate(doc); // Uint8Array

  await prisma.yDoc.create({
    data: { name: sessionId, data: Buffer.from(state) }
  });
}

// ===== Participant ops =====

export const joinSession = async (
  sessionId: string,
  user: { id: string; username: string }
) => {
  const session = await prisma.collabSession.findUnique({
    where: { id: sessionId }
  });
  if (!session || session.status !== "ACTIVE") return null;

  // Upsert participant (rejoining clears leftAt)
  await prisma.participant.upsert({
    where: { sessionId_userId: { sessionId, userId: user.id } },
    update: { leftAt: null, username: user.username },
    create: { sessionId, userId: user.id, username: user.username }
  });

  return prisma.collabSession.findUnique({
    where: { id: sessionId },
    include: { participants: true }
  });
}

export const leaveSession = async (
  sessionId: string,
  userId: string
) => {
  await prisma.participant.updateMany({
    where: { sessionId, userId, leftAt: null },
    data: { leftAt: new Date() }
  });
  return true;
}


