import 'dotenv/config';
import { Server } from '@hocuspocus/server';
import { Database } from '@hocuspocus/extension-database';
import { Redis } from 'ioredis';
import { prisma } from './model/collab-model.ts';

const YWS_PORT = Number(process.env.YWS_PORT || 1234);
const REDIS_URL = process.env.REDIS_URL || '';
const CACHE_PREFIX = process.env.REDIS_CACHE_PREFIX || 'yws:doc:';
const DIRTY_SET_KEY = process.env.REDIS_DIRTY_SET_KEY || 'yws:dirty';
const REDIS_TTL_SECONDS = Number(process.env.REDIS_TTL_SECONDS || 3600);
const DB_FLUSH_INTERVAL_MS = Number(process.env.DB_FLUSH_INTERVAL_MS || 15000);

const keyFor = (name: string) => `${CACHE_PREFIX}${name}`;

async function main() {
  const redis = new Redis(REDIS_URL);

  const server = new Server({
    port: YWS_PORT,
    debounce: 2000,     // write to Redis after 2s idle
    maxDebounce: 5000,  // or at most every 5s
    extensions: [
      new Database({
        fetch: async ({ documentName }) => {
          // 1) try cache
          const cached = await redis.getBuffer(keyFor(documentName));
          if (cached && cached.length) return new Uint8Array(cached);

          // 2) fallback to DB
          const row = await prisma.yDoc.findUnique({ where: { name: documentName } });
          if (!row) return null;

          const buf = Buffer.from(row.data);
          // 3) populate cache
          await redis.setex(keyFor(documentName), REDIS_TTL_SECONDS, buf);
          return new Uint8Array(buf);
        },

        store: async ({ documentName, state }) => {
          const buf = Buffer.from(state);
          await redis.setex(keyFor(documentName), REDIS_TTL_SECONDS, buf);
          await redis.sadd(DIRTY_SET_KEY, documentName);
        },
      }),
    ],
  });

  // Write-back flush (15s)
  setInterval(async () => {
    try {
      const names = await redis.smembers(DIRTY_SET_KEY);
      if (!names.length) return;

      for (const name of names) {
        const blob = await redis.getBuffer(keyFor(name));
        if (!blob) {
          await redis.srem(DIRTY_SET_KEY, name);
          continue;
        }

        await prisma.yDoc.upsert({
          where: { name },
          update: { data: blob },
          create: { name, data: blob },
        });

        // mark clean
        await redis.srem(DIRTY_SET_KEY, name);
      }
    } catch (e) {
      console.warn('flush error:', (e as Error).message);
    }
  }, DB_FLUSH_INTERVAL_MS);

  await server.listen();
  console.log(`[yws] listening :${YWS_PORT} | Redis=${REDIS_URL} | flush=${DB_FLUSH_INTERVAL_MS}ms`);
}

main().catch((err) => {
  console.error('Failed to start Yws:', err);
  process.exit(1);
});