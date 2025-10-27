// Y-websocket server

import 'dotenv/config';
import { Server } from '@hocuspocus/server';
import { Redis as RedisExtension } from '@hocuspocus/extension-redis';
import { Database } from '@hocuspocus/extension-database';

import { prisma } from './model/collab-model.ts'; // your existing PrismaClient export

const YWS_PORT = Number(process.env.YWS_PORT || 1234);
const REDIS_URL = process.env.REDIS_URL || 'redis://127.0.0.1:6379';

async function main() {

  const server = new Server({
    port: YWS_PORT,
    debounce: 2000,     // saves 2 seconds after stop typing
    maxDebounce: 5000,  // forced saves every 5 seconds
    extensions: [
      new RedisExtension({ host: "127.0.0.1", port: 6379 }), // awareness/broadcast via Redis - pub/sub
      new Database({
        fetch: async ({ documentName }) => {
          const row = await prisma.yDoc.findUnique({ where: { name: documentName }});
          return row ? new Uint8Array(row.data) : null;
        },
        store: async ({ documentName, state }) => {
          await prisma.yDoc.upsert({
            where: { name: documentName },
            update: { data: Buffer.from(state) },
            create: { name: documentName, data: Buffer.from(state) },
          });
        },
      }),
    ],


  });

  await server.listen();
  console.log(`[yws] Hocuspocus listening on :${YWS_PORT} | Redis=${REDIS_URL}`);
}

main().catch((err) => {
  console.error('Failed to start Yjs server:', err);
  process.exit(1);
});