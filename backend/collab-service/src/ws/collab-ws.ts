import { Server as HttpServer } from "http";
import { parse as parseUrl } from "url";
import jwt from "jsonwebtoken";
import { prisma } from "../model/collab-model.ts";
import { createRequire } from "module";
import 'dotenv/config';

const require = createRequire(import.meta.url);
const httpProxy = require("http-proxy");

function verifyAccessToken(token: string) {
  const secret = process.env.ACCESS_JWT_SECRET!;
  const decoded: any = jwt.verify(token, secret);
  const id = decoded.sub || decoded.id;
  if (!id) throw new Error("Token missing subject");
  return { id, username: decoded.username as string };
}

async function authorize(roomId: string, user: { id: string; username?: string }) {
  await prisma.$transaction(async (tx) => {
    // Serialize joins per room (prevents race where two newcomers slip in)
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${user.id}))`;
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${roomId}))`;

    // Check if session is active
    const session = await tx.collabSession.findUnique({ where: { id: roomId } });
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) throw new Error("SESSION_EXPIRED");

    // Block if user is active in ANOTHER session (leftAt IS NULL & status ACTIVE) - at max 1 session
    const otherActive = await tx.participant.findFirst({
      where: {
        userId: user.id,
        leftAt: null,
        NOT: { sessionId: roomId },
        session: { status: "ACTIVE" },
      },
      select: { sessionId: true },
    });
    if (otherActive) {
      const err: any = new Error("USER_ALREADY_IN_ACTIVE_SESSION");
      err.sessionId = otherActive.sessionId;
      throw err;
    }

    // Check if room is full
    const existing = await tx.participant.findUnique({
      where: { sessionId_userId: { sessionId: roomId, userId: user.id } },
    });
    const totalParticipants = await tx.participant.count({
      where: { sessionId: roomId },
    });
    if (!existing && totalParticipants >= 2) throw new Error("ROOM_FULL");

    // Participant joins the room
    await tx.participant.upsert({
      where: { sessionId_userId: { sessionId: roomId, userId: user.id } },
      update: { leftAt: null, username: user.username ?? "" },
      create: { sessionId: roomId, userId: user.id, username: user.username ?? "" },
    });
  }, { isolationLevel: 'Serializable' }); 
}

const TARGET_WS =  process.env.YWS_TARGET || "ws://127.0.0.1:1234";
const proxy = httpProxy.createProxyServer({ target: TARGET_WS, ws: true, changeOrigin: true });

// log proxy errors (e.g., upstream not running)
proxy.on("error", (err: any, _req: any, socket: any) => {
  console.error("[WS proxy] error:", err?.code || err?.message || err);
  try { socket?.destroy(); } catch {}
});

/* This is a proxy gateway that hooks on to ser*/
export function installCollabWsProxy(server: HttpServer) {
  server.on("upgrade", async (req, socket, head) => {
    try {
      const url = parseUrl(req.url || "", true);
      const segments = (url.pathname || "").split("/").filter(Boolean);
      if (segments.length < 3 || segments[0] !== "collab" || segments[1] !== "ws") return;

      const roomId = segments[2];
      if (!roomId) { console.error("WS: missing roomId"); return socket.destroy(); }

      let token: string | undefined = (url.query?.token as string) || undefined;
      if (!token && typeof req.headers.authorization === "string") {
        const h = req.headers.authorization;
        if (h.startsWith("Bearer ")) token = h.slice(7);
      }

      // subprotocol: Sec-WebSocket-Protocol: jwt.<token>  (client sets protocols ["jwt."+token])
      if (!token && typeof req.headers["sec-websocket-protocol"] === "string") {
        const parts = req.headers["sec-websocket-protocol"].split(",").map(s => s.trim());
        const j = parts.find(p => p.startsWith("jwt."));
        if (j) token = j.slice(4);
      }

      // debug log 
      console.log("[WS upgrade]", {
        path: url.pathname, roomId, hasToken: !!token,
        authHeader: req.headers.authorization, queryTokenPresent: !!url.query?.token
      });

      if (!token) { console.error("WS: missing token"); return socket.destroy(); }

      const user = verifyAccessToken(token);
      await authorize(roomId, user);

      // Rewrite the path so upstream sees "/<roomId>"
      // http-proxy uses req.url to decide where to connect
      (req as any).url = `/${roomId}`;

      proxy.ws(req, socket, head);
    } catch (e:any) {
      console.error("[WS upgrade] failed:", e?.message || e);
      socket.destroy(); // unauthorized / not active
    }
  });
}

