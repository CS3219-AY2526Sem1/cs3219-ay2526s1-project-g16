import axios from "axios";
import { PrismaClient, Prisma } from "../generated/prisma/index.js";
import { nanoid } from "nanoid";
import { createClient } from "redis";
import { publishMatchForUser } from "./match-events.ts"; 

//=========================== PRISMA ===========================
const prisma = new PrismaClient();

//=========================== REDIS ===========================
const redis = createClient({
  url: process.env.REDIS_URL ?? "redis://172.17.0.1:6379",
});

redis.on("error", (err) => {
  console.error("[redis] client error", err);
});

export async function initConnection() {
  await prisma.$connect();
  if (!redis.isOpen) {
    await redis.connect();
  }
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
      userId: string;
      partnerId: string;
      startedTime?: Date;
      expiresAt?: Date;
      language?: string;
      difficulty?: string;
      topic?: string;
      questionId: string;
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

//=========================== REDIS QUEUE STRUCTURE ===========================
const MATCH_QUEUE_KEY = "match:queue";
const MATCH_TICKET_PREFIX = "match:ticket:";

type RedisTicket = {
  userId: string;
  languagePref: string[];
  difficultyPref: string[];
  topicPref: string[];
  expiresAt: number;
  createdAt: number;
};

//=========================== CORE ===========================
export async function enqueueOrMatch(input: MatchInput): Promise<MatchResult> {
  const { userId, ttlMs = DEFAULT_TTL_MS, languageIn, difficultyIn, topicIn } = input;

  const langSet = sanitizeSet(languageIn);
  const diffSet = sanitizeSet(difficultyIn);
  const topicSet = sanitizeSet(topicIn);

  const now = Date.now();
  const expiresAtMs = now + ttlMs;
  const expiresAt = new Date(expiresAtMs);

  await cleanupExpiredTickets(now);

  await removeTicket(userId);

  const partnerTicket = await findPartnerForUser({
    userId,
    languagePref: langSet,
    difficultyPref: diffSet,
    topicPref: topicSet,
  });

  if (partnerTicket) {
    const overlap = computePreferenceOverlap(
      {
        languagePref: langSet,
        difficultyPref: diffSet,
        topicPref: topicSet,
      },
      {
        languagePref: partnerTicket.languagePref,
        difficultyPref: partnerTicket.difficultyPref,
        topicPref: partnerTicket.topicPref,
      }
    );

    if (
      !overlap.language.length ||
      !overlap.difficulty.length ||
      !overlap.topic.length
    ) {
      await saveTicket({
        userId,
        languagePref: langSet,
        difficultyPref: diffSet,
        topicPref: topicSet,
        createdAt: now,
        expiresAt: expiresAtMs,
      });
      return { status: "queued", expiresAt, startedTime: new Date(now) };
    }

    const chosenLanguage = pickOne(overlap.language) ?? "unspecified";
    const chosenDifficulty = pickOne(overlap.difficulty) ?? "unspecified";
    const chosenTopic = pickOne(overlap.topic) ?? "unspecified";

    let chosenQuestionId: string | null = null;
    try {
      chosenQuestionId = await getQuestionId(chosenTopic, chosenLanguage, chosenDifficulty);
    } catch (e) {
      console.warn("[match] getQuestionId failed; falling back to null:", e);
    }

    const roomId = getRoomId();

    console.log("[match] chosen overlap", {
      userId,
      partnerId: partnerTicket.userId,
      language: chosenLanguage,
      difficulty: chosenDifficulty,
      topic: chosenTopic,
      questionId: chosenQuestionId,
    });

    await writeMatchedUsers({
      userAId: userId,
      userBId: partnerTicket.userId,
      roomId,
      language: chosenLanguage,
      difficulty: chosenDifficulty,
      topic: chosenTopic,
      questionId: chosenQuestionId ?? null,
      matchedAt: new Date(),
    });

    const payloadForA = {
      type: "MATCH_FOUND",
      roomId,
      partnerId: partnerTicket.userId,
      language: chosenLanguage,
      difficulty: chosenDifficulty,
      topic: chosenTopic,
      questionId: chosenQuestionId ?? null,
      at: new Date().toISOString(),
    };

    const payloadForB = {
      type: "MATCH_FOUND",
      roomId,
      partnerId: userId,
      language: chosenLanguage,
      difficulty: chosenDifficulty,
      topic: chosenTopic,
      questionId: chosenQuestionId ?? null,
      at: new Date().toISOString(),
    };

    await Promise.all([
      publishMatchForUser(userId, payloadForA),
      publishMatchForUser(partnerTicket.userId, payloadForB),
    ]);

    return {
      status: "matched",
      roomId,
      userId,
      partnerId: partnerTicket.userId,
      startedTime: new Date(),
      expiresAt,
      language: chosenLanguage,
      difficulty: chosenDifficulty,
      topic: chosenTopic,
      questionId: chosenQuestionId ?? "",
    };
  }

  await saveTicket({
    userId,
    languagePref: langSet,
    difficultyPref: diffSet,
    topicPref: topicSet,
    createdAt: now,
    expiresAt: expiresAtMs,
  });

  return { status: "queued", expiresAt, startedTime: new Date(now) };
}

export async function getStatus(userId: string): Promise<MatchResult> {
  const key = MATCH_TICKET_PREFIX + userId;
  const raw = await redis.get(key);

  if (!raw) {
    return { status: "not_found", startedTime: new Date() };
  }

  const ticket: RedisTicket = JSON.parse(raw);
  const now = Date.now();

  if (ticket.expiresAt <= now) {
    await removeTicket(userId);
    return { status: "not_found", startedTime: new Date(ticket.createdAt) };
  }

  return {
    status: "queued",
    expiresAt: new Date(ticket.expiresAt),
    startedTime: new Date(ticket.createdAt),
  };
}

export async function cancel(userId: string): Promise<MatchResult> {
  const key = MATCH_TICKET_PREFIX + userId;
  const raw = await redis.get(key);
  if (!raw) return { status: "not_found" };

  await removeTicket(userId);
  return { status: "cancelled", startedTime: new Date() };
}

//=========================== REDIS HELPERS ===========================
async function saveTicket(ticket: RedisTicket): Promise<void> {
  const key = MATCH_TICKET_PREFIX + ticket.userId;
  const ttlMs = ticket.expiresAt - Date.now();

  const multi = redis.multi();

  if (ttlMs > 0) {
    multi.set(key, JSON.stringify(ticket), { PX: ttlMs });
  } else {
    multi.set(key, JSON.stringify(ticket));
  }

  multi.zAdd(MATCH_QUEUE_KEY, [{ score: ticket.createdAt, value: ticket.userId }]);

  await multi.exec();
}

async function removeTicket(userId: string): Promise<void> {
  const key = MATCH_TICKET_PREFIX + userId;
  await redis.multi().del(key).zRem(MATCH_QUEUE_KEY, userId).exec();
}

async function cleanupExpiredTickets(nowMs: number): Promise<void> {
  const candidateIds: string[] = await redis.zRange(MATCH_QUEUE_KEY, 0, -1);
  if (candidateIds.length === 0) return;

  const multiGet = redis.multi();
  for (const userId of candidateIds) {
    const key = MATCH_TICKET_PREFIX + userId;
    multiGet.get(key);
  }

  const res = await multiGet.exec();
  if (!res) return;

  const replies = res as unknown as (string | null)[];

  const multiCleanup = redis.multi();

  candidateIds.forEach((userId: string, idx: number) => {
    const val = replies[idx];

    if (!val) {
      multiCleanup.zRem(MATCH_QUEUE_KEY, userId);
      multiCleanup.del(MATCH_TICKET_PREFIX + userId);
      return;
    }

    const ticket: RedisTicket = JSON.parse(val);
    if (ticket.expiresAt <= nowMs) {
      multiCleanup.zRem(MATCH_QUEUE_KEY, userId);
      multiCleanup.del(MATCH_TICKET_PREFIX + userId);
    }
  });

  await multiCleanup.exec();
}


async function findPartnerForUser(self: {
  userId: string;
  languagePref: string[];
  difficultyPref: string[];
  topicPref: string[];
}): Promise<RedisTicket | null> {
  const now = Date.now();

  const candidateIds = await redis.zRange(MATCH_QUEUE_KEY, 0, 49);
  if (!candidateIds.length) return null;

  for (const candidateUserId of candidateIds) {
    if (candidateUserId === self.userId) continue;

    const key = MATCH_TICKET_PREFIX + candidateUserId;
    const raw = await redis.get(key);

    if (!raw) {
      await redis.zRem(MATCH_QUEUE_KEY, candidateUserId);
      continue;
    }

    const ticket: RedisTicket = JSON.parse(raw);

    if (ticket.expiresAt <= now) {
      await removeTicket(candidateUserId);
      continue;
    }

    const overlap = computePreferenceOverlap(
      {
        languagePref: self.languagePref,
        difficultyPref: self.difficultyPref,
        topicPref: self.topicPref,
      },
      {
        languagePref: ticket.languagePref,
        difficultyPref: ticket.difficultyPref,
        topicPref: ticket.topicPref,
      }
    );

    if (
      overlap.language.length &&
      overlap.difficulty.length &&
      overlap.topic.length
    ) {
      await removeTicket(candidateUserId);
      return ticket;
    }
  }

  return null;
}

//=========================== PRIVATE (unchanged helpers) ===========================
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
  if (!a.length || !b || !b.length) return false;

  const normalizedA = a.map(normalize);
  const normalizedB = b.map(normalize);
  const bSet = new Set(normalizedB);

  return normalizedA.some((item) => bSet.has(normalize(item)));
}

//=========================== QUESTION + MATCH STORAGE ===========================
export async function getQuestionId(
  topic?: string,
  language?: string,
  difficulty?: string
): Promise<string> {
  const baseURL = process.env.QUESTION_SERVICE_URL ?? "http://question:3002";
  const params: Record<string, string> = {};

  if (difficulty) params["difficulty"] = difficulty;
  if (topic) params["topicNames"] = topic;

  console.log("PARAMS:", params);

  try {
    const response = await axios.get(`${baseURL}/questions`, { params });
    const items = response.data.items;
    console.log("Response received:", response.data.items);

    if (!Array.isArray(items) || items.length === 0) {
      throw new Error("No question found for the given filters");
    }

    const randomIndex = Math.floor(Math.random() * items.length);
    const randomId = items[randomIndex].id;

    console.log(`Got Random QuestionID: ${randomId} (index ${randomIndex})`);
    return String(randomId);
  } catch (err: any) {
    console.error("Error fetching question ID:", err.message);
    throw err;
  }
}

export async function writeMatchedUsers(_args: {
  userAId: string;
  userBId: string;
  roomId: string;
  language: string;
  difficulty: string;
  topic: string;
  questionId: string | null;
  matchedAt?: Date;
}) {
  console.log("[writeMatchedUsers] skipped DB write (no-op)");
  return Promise.resolve();
}
