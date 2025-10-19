// src/events.ts
import pgPkg from "pg";
const { Client } = pgPkg;

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

export async function startPgEvents() {
  if (started) return;
  started = true;

  client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();
  await client.query('LISTEN ticket_changes');

  client.on('notification', (n) => {
    if (!n.payload) return;
    try {
      const msg: TicketChange = JSON.parse(n.payload);
      const set = subs.get(msg.userId);
      if (!set || set.size === 0) return;
      for (const fn of set) {
        try { fn(msg); } catch {}
      }
    } catch {
      // swallow malformed payloads
    }
  });

  client.on('error', (err) => {
    console.error('[events] pg error', err);
  });

  console.log('[events] LISTEN ticket_changes');
}

/** Subscribe to a single user’s ticket stream; returns an unsubscribe fn */
export function subscribeUser(userId: string, h: Handler): () => void {
  let set = subs.get(userId);
  if (!set) {
    set = new Set();
    subs.set(userId, set);
  }
  set.add(h);
  return () => {
    const s = subs.get(userId);
    if (!s) return;
    s.delete(h);
    if (s.size === 0) subs.delete(userId);
  };
}
