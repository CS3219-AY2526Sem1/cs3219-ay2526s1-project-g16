// Simple periodic sweeper (no advisory lock).
// Expires QUEUED tickets whose expiresAt < now() and logs what it did.

import { PrismaClient, Prisma } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const SWEEP_INTERVAL_MS = 1_000;  // run every 1s
const BATCH_LIMIT = 500;          // cap per pass
const SAMPLE_LOG_LIMIT = 10;

const ts = () => new Date().toISOString();

async function sweepOnce() {
  const expired = await prisma.$queryRaw<Array<{ id: string; userId: string; expiresAt: Date }>>(
    Prisma.sql`
      WITH stale AS (
        SELECT "id","userId"
        FROM "matchservice"."matchticket"
        WHERE "status" = 'QUEUED' AND "expiresAt" < now()
        ORDER BY "createdAt" ASC
        LIMIT ${Prisma.raw(String(BATCH_LIMIT))}
      )
      UPDATE "matchservice"."matchticket" t
      SET "status" = 'EXPIRED'
      FROM stale
      WHERE t."id" = stale."id"
      RETURNING t."id", t."userId", t."expiresAt";
    `
  );

  if (expired.length > 0) {
    console.log(`[${ts()}] [sweeper] expired ${expired.length} ticket(s):`);
    console.table(
      expired.slice(0, SAMPLE_LOG_LIMIT).map(r => ({
        id: r.id,
        userId: r.userId,
        expiresAt: r.expiresAt.toISOString(),
      }))
    );
  }
}

export async function startMatchSweeper() {
  console.log(`[${ts()}] [sweeper] starting… interval=${SWEEP_INTERVAL_MS}ms, batch=${BATCH_LIMIT}`);
  await prisma.$connect();
  console.log(`[${ts()}] [sweeper] connected to DB, first sweep now`);

  try { await sweepOnce(); } catch (e) { console.error(`[${ts()}] [sweeper] initial sweep error:`, e); }

  const timer = setInterval(async () => {
    try { await sweepOnce(); }
    catch (e) { console.error(`[${ts()}] [sweeper] sweep error:`, e); }
  }, SWEEP_INTERVAL_MS);

  return async () => {
    clearInterval(timer);
    try { await prisma.$disconnect(); } catch {}
    console.log(`[${ts()}] [sweeper] stopped`);
  };
}
