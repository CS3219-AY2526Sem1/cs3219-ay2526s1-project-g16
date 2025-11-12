import { createClient } from "redis";

const redisPub = createClient({
  url: process.env.REDIS_URL ?? "redis://172.17.0.1:6379",
});

redisPub.on("error", (err) => {
  console.error("[redisPub] error", err);
});

async function ensureRedisPubConnected() {
  if (redisPub.isOpen) return;
  console.log("[redisPub] connecting...");
  await redisPub.connect();
  console.log("[redisPub] connected");
}

export async function publishMatchForUser(userId: string, payload: any) {
  const channel = `match:user:${userId}`;

  await ensureRedisPubConnected();

  try {
    const msg = JSON.stringify(payload);
    console.log("[redisPub] publish", channel, msg);
    await redisPub.publish(channel, msg);
  } catch (err) {
    console.error("[redisPub] failed to publish", err);
  }
}
