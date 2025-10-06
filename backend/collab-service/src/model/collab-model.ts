import { PrismaClient } from "../generated/prisma/index.js";

export const prisma = new PrismaClient();

export const initConnection = async (): Promise<void> => {
  try {
    await prisma.$connect();
    console.log("Prisma connected");
  } catch (error) {
    console.error("Failed to connect to the database:", error);
    process.exit(1); 
  }
};

// ====== Session ops =====

export const createSession = async (
  roomId: string,
  topic: string,
  difficulty: string,
  questionId?: string | null,
  expiresAt?: Date | null
) => {
  return await prisma.collabSession.create({
    data: {
      id: roomId,
      topic,
      difficulty,
      questionId: questionId ?? null,
      expiresAt: expiresAt ?? null,
    },
    include: { participants: true },
  });
};

export const endSession = async (sessionId: string) => {
  return await prisma.collabSession.update({
    where: { id: sessionId },
    data: { status: "ENDED"}
  });
};

export const getSession = async (sessionId: string) => {
  return await prisma.collabSession.findUnique({
    where: { id: sessionId },
    include: { participants: true }
  });
};

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


