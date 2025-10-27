// Simple periodic sweeper (no advisory lock).
// Deletes QUEUED tickets whose expiresAt < now() and logs what it did.

import { PrismaClient, Prisma } from "../generated/prisma/index.js";

const prisma = new PrismaClient();

const SWEEP_INTERVAL_MS = 1_000;
const BATCH_LIMIT = 500;
const SAMPLE_LOG_LIMIT = 10;

const ts = () => new Date().toISOString();

// Deletes tickets whose expiresAt <= now() and logs what it did.
async function sweepOnce() {
  const deleted = await prisma.$queryRaw<
    Array<{ id: string; userId: string; expiresAt: Date }>
  >(Prisma.sql`
    WITH stale AS (
      SELECT t."id", t."userId", t."expiresAt"
      FROM "matchservice"."matchticket" t
      WHERE 
        -- drop status filter (or widen below)
        -- ("status" IS NULL OR "status" = 'QUEUED')
        -- handle timestamp without time zone safely by coercing both sides
        (t."expiresAt" AT TIME ZONE 'UTC') <= (now() AT TIME ZONE 'UTC')
      ORDER BY t."createdAt" ASC
      LIMIT ${Prisma.raw(String(BATCH_LIMIT))}
      FOR UPDATE SKIP LOCKED
    ),
    _del AS (
      DELETE FROM "matchservice"."matchticket" d
      USING stale
      WHERE d."id" = stale."id"
      RETURNING d."id", d."userId", d."expiresAt"
    )
    SELECT * FROM _del;
  `);

  if (deleted.length > 0) {
    console.log(`[${ts()}] [sweeper] deleted ${deleted.length} expired ticket(s):`);
    console.table(
      deleted.slice(0, SAMPLE_LOG_LIMIT).map(r => ({
        id: r.id,
        userId: r.userId,
        expiresAt: (r.expiresAt instanceof Date ? r.expiresAt : new Date(r.expiresAt)).toISOString(),
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
