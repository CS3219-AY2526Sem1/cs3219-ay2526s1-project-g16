import type { Request, Response } from "express";
import { z } from "zod";
import { createClient } from "redis";

type SignalPayload = any;

const MATCH_USER_CHANNEL_PREFIX = "match:user:";

//=========================== IN-MEMORY SIGNAL BUS ===========================
const matchSignals = new Map<string, Set<(data: SignalPayload) => void>>();

function registerSignal(userId: string, fn: (data: SignalPayload) => void) {
  let set = matchSignals.get(userId);
  if (!set) {
    set = new Set();
    matchSignals.set(userId, set);
  }
  set.add(fn);
  return () => {
    const s = matchSignals.get(userId);
    if (!s) return;
    s.delete(fn);
    if (s.size === 0) matchSignals.delete(userId);
  };
}

function fireSignal(userId: string, data: SignalPayload): number {
  const listeners = matchSignals.get(userId);
  if (!listeners || listeners.size === 0) return 0;
  listeners.forEach((fn) => fn(data));
  matchSignals.delete(userId);
  return listeners.size;
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

//=========================== REDIS PUB/SUB BRIDGE ===========================
const redisSub = createClient({
  url: process.env.REDIS_URL ?? "redis://172.17.0.1:6379",
});

redisSub.on("error", (err) => {
  console.error("[redisSub] client error", err);
});

let bridgeInitialized = false;

export async function initMatchRedisBridge() {
  if (bridgeInitialized) return;

  if (!redisSub.isOpen) {
    console.log("[match-SSE] Connecting redisSub...");
    await redisSub.connect();
    console.log("[match-SSE] redisSub connected");
  }

  await redisSub.pSubscribe(
    `${MATCH_USER_CHANNEL_PREFIX}*`,
    (message: string, channel: string) => {
      console.log("[match-SSE] pubsub message", { channel, message });

      if (!channel.startsWith(MATCH_USER_CHANNEL_PREFIX)) return;
      const userId = channel.slice(MATCH_USER_CHANNEL_PREFIX.length);

      let payload: any;
      try {
        payload = JSON.parse(message);
      } catch {
        payload = { raw: message };
      }

      const delivered = fireSignal(userId, payload);
      console.log("[match-SSE] fired signal for user", userId, "delivered:", delivered);
    }
  );

  bridgeInitialized = true;
  console.log("[match-SSE] Subscribed to pattern match:user:*");
}

//=========================== SSE HANDLER ===========================
export async function subscribeMatchSSE(req: Request, res: Response) {
  const parsed = z.string().min(1).safeParse(req.params.userId);
  if (!parsed.success) {
    res.status(400).end("Invalid userId");
    return;
  }
  const userId = parsed.data;

  const ttlMsRaw = Number(req.query.ttlMs);
  const SSE_WINDOW_MS =
    Number.isFinite(ttlMsRaw) && ttlMsRaw > 0
      ? Math.min(ttlMsRaw, 10 * 60 * 1000)
      : 30_000;

  try {
    await initMatchRedisBridge();
  } catch (err) {
    console.error("[match-SSE] Failed to init Redis bridge", err);
    res.status(500).json({ error: "Internal error (redis bridge)" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  let heartbeat: NodeJS.Timeout | null = null;
  let timeout: NodeJS.Timeout | null = null;
  let unregisterSignal: (() => void) | null = null;
  let stopped = false;

  const safeClear = () => {
    if (heartbeat) {
      clearInterval(heartbeat);
      heartbeat = null;
    }
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
    if (unregisterSignal) {
      try {
        unregisterSignal();
      } catch {}
      unregisterSignal = null;
    }
  };

  const safeEnd = (event: "MATCH_FOUND" | "TIMEOUT", data: any) => {
    if (res.writableEnded) return;

    let roomId: string | null = null;
    if (data && typeof data === "object") {
      const d = data as any;
      if (d.session && typeof d.session === "object" && d.session.roomId) {
        roomId = String(d.session.roomId);
      } else if (d.roomId) {
        roomId = String(d.roomId);
      }
    }

    try {
      res.write(`event: ${event}\n`);
      if (roomId) {
        res.write(`roomId: ${roomId}\n`);
      }
      const payload = {
        status: event,
        ...((data && typeof data === "object") ? data : {}),
      };
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch {
      // ignore write errors
    }
    stopped = true;
    safeClear();
    res.end();
  };

  heartbeat = setInterval(() => {
    if (!res.writableEnded) {
      res.write(`event: heartbeat\ndata: {}\n\n`);
    }
  }, 15_000);

  unregisterSignal = registerSignal(userId, (data: any) => {
    if (stopped || res.writableEnded) return;

    const type =
      data && typeof data === "object" && data.type
        ? String(data.type).toUpperCase()
        : "MATCH_FOUND";

    if (type === "TIMEOUT") {
      safeEnd("TIMEOUT", data ?? { message: "Timed out" });
    } else {
      safeEnd("MATCH_FOUND", data ?? { message: "Signalled match" });
    }
  });

  timeout = setTimeout(() => {
    if (!stopped) {
      safeEnd("TIMEOUT", { message: "No match found within window" });
    }
  }, SSE_WINDOW_MS);

  req.on("close", () => {
    stopped = true;
    safeClear();
  });
}

//=========================== HTTP SIGNAL ENTRYPOINT (MANUAL) ===========================
export function signalMatchFound(req: Request, res: Response) {
  const parsedUserId = z.string().min(1).safeParse(req.params.userId);
  if (!parsedUserId.success) {
    return res.status(400).json({ error: "Invalid userId" });
  }
  const userId = parsedUserId.data;

  const parsedRoomId = z
    .string()
    .min(1)
    .optional()
    .safeParse(req.body?.roomId ?? req.query?.roomId);
  const roomId = parsedRoomId.success ? parsedRoomId.data : undefined;

  console.log("[DEBUG] Sending roomId via HTTP signal: ", roomId);
  const payload = {
    type: "MATCH_FOUND",
    session: {
      userId,
      roomId: roomId ?? null,
      via: "manual-signal",
      at: new Date().toISOString(),
    },
    ...(typeof req.body === "object" && req.body ? req.body : {}),
  };

  const delivered = fireSignal(userId, payload);
  if (delivered === 0) {
    return res
      .status(404)
      .json({ error: "No live SSE subscribers for userId" });
  }

  return res.json({ ok: true, delivered, userId, roomId });
}

export { fireSignal };
