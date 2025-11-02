// src/events.ts
import pgPkg from "pg";
const { Client } = pgPkg;
import axios from "axios";

const COLLAB_BASE = process.env.COLLAB_SERVICE_URL ?? "http://collab:3009";

type TicketChange = {
  userId: string;
  status: "QUEUED" | "MATCHED" | "CANCELLED" | "EXPIRED";
  roomId?: string | null;
  partnerId?: string | null;
  expiresAt?: string | null;
  createdAt?: string | null;
};

type Handler = (msg: TicketChange) => void;

const subs = new Map<string, Set<Handler>>();

let started = false;
let client: InstanceType<typeof Client> | null = null;

const MIN_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;

const CHANNELS = ["ticket_changes"] as const;

async function connectAndListen(): Promise<void> {
  if (client) {
    try { client.removeAllListeners(); await client.end(); } catch {}
    client = null;
  }

  client = new Client({
    connectionString: process.env.DATABASE_URL,
    application_name: "match-events-listener",
    keepAlive: true,
    statement_timeout: 0,
    query_timeout: 0,
  });

  await client.connect();

  for (const ch of CHANNELS) {
    await client.query(`LISTEN ${ch}`);
  }

  client.on("notification", (n) => {
    if (!n.payload) return;
    try {
      const msg: TicketChange = JSON.parse(n.payload);
      const set = subs.get(msg.userId);
      if (!set || set.size === 0) return;
      for (const fn of set) {
        try { fn(msg); } catch (e) { console.warn("[events] handler err", e); }
      }
    } catch (e) {
      console.warn("[events] bad payload", e);
    }
  });

  client.on("error", (err) => {
    console.error("[events] pg error; will reconnect", err);
    scheduleReconnect();
  });

  client.on("end", () => {
    console.error("[events] pg connection ended; will reconnect");
    scheduleReconnect();
  });

  console.log("[events] LISTEN", CHANNELS.join(", "));
}

let reconnecting = false;
let attempt = 0;
let reconnectTimer: NodeJS.Timeout | null = null;

function scheduleReconnect() {
  if (reconnecting) return;
  reconnecting = true;

  const delay = Math.min(
    MAX_DELAY_MS,
    Math.round(MIN_DELAY_MS * 2 ** attempt)
  );

  if (reconnectTimer) clearTimeout(reconnectTimer);

  reconnectTimer = setTimeout(async () => {
    try {
      await connectAndListen();
      attempt = 0;
      reconnecting = false;
      reconnectTimer = null;
      console.log("[events] reconnected & re-LISTENed");
    } catch (e) {
      attempt++;
      reconnecting = false;
      console.error("[events] reconnect failed; will retry", e);
      scheduleReconnect();
    }
  }, delay);
}

export async function startPgEvents() {
  if (started) return;
  started = true;

  try {
    await connectAndListen();
  } catch (e) {
    console.error("[events] initial connect failed; entering retry loop", e);
    attempt = 1;
    scheduleReconnect();
  }
}

export function subscribeUser(userId: string, h: Handler): () => void {
  let set = subs.get(userId);
  if (!set) {
    set = new Set();
    subs.set(userId, set);
  }
  set.add(h);

  void (async () => {
    const session = await findActiveSessionByUsername(userId);
    if (session && session.status === "ACTIVE") {
      try {
        h({ type: "already-in-active-session", data: { session } });
      } finally {
        const s = subs.get(userId);
        if (!s) return;
        s.delete(h);
        if (s.size === 0) subs.delete(userId);
      }
    }
  })();

  return () => {
    const s = subs.get(userId);
    if (!s) return;
    s.delete(h);
    if (s.size === 0) subs.delete(userId);
  };
}

export async function findActiveSessionByUsername(username: string) {
  try {
    const response = await axios.post(`${COLLAB_BASE}/sessions/active/username`, {
      username,
    });

    if (response.status === 200) {
      console.log("Active session:", response.data);
      return response.data;
    } else {
      console.warn("No active session found:", response.status);
      return null;
    }
  } catch (err: any) {
    console.error("Error fetching active session:", err.message);
    return null;
  }
}