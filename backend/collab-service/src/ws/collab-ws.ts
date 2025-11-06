import { Server as HttpServer } from "http";
import { parse as parseUrl } from "url";
import jwt from "jsonwebtoken";
import { prisma } from "../model/collab-model.ts";
import { createRequire } from "module";
import 'dotenv/config';
import cookie from "cookie";

const require = createRequire(import.meta.url);
const httpProxy = require("http-proxy");

const TARGET_WS =  process.env.YWS_TARGET || "ws://127.0.0.1:1234";
const proxy = httpProxy.createProxyServer({ target: TARGET_WS, ws: true, changeOrigin: true });

// ====== Auth Details ======
function readJwtFromCookie(req: any): string | undefined {
  const raw = req.headers?.cookie as string | undefined;
  if (!raw) return undefined;
  const parsed = cookie.parse(raw);
  return parsed.jwt_access_token; 
}

function verifyAccessToken(token: string) {
  const secret = process.env.ACCESS_JWT_SECRET!;
  const decoded: any = jwt.verify(token, secret);

  const id = decoded.sub || decoded.id;
  if (!id) throw new Error("Token missing subject");

  const out: { id: string; username?: string } = { id: String(id) };
  if (typeof decoded.username === "string" && decoded.username.length > 0) {
    out.username = decoded.username;
  }
  return out;
}

function rejectUpgrade(socket: any, code: number, reason: string) {
  try {
    socket.write(
      `HTTP/1.1 ${code} ${reason}\r\n` +
      "Connection: close\r\n" +
      "Content-Type: text/plain\r\n" +
      "Content-Length: " + Buffer.byteLength(reason) + "\r\n" +
      "\r\n" +
      reason
    );
  } catch {}
  try { socket.destroy(); } catch {}
}

proxy.on("error", (err: any, _req: any, socket: any) => {
  console.error("[WS proxy] error:", err?.code || err?.message || err);
  try { socket?.destroy(); } catch {}
});

// ====== Websocket proxy gateway authorisation ====== 
async function authorize(roomId: string, user: { id: string; username?: string }) {
  await prisma.$transaction(async (tx) => {
    // Serialize checks per room to avoid races
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${roomId}))`;

    // Check if session is active
    const session = await tx.collabSession.findUnique({ where: { id: roomId } });
    if (!session) throw new Error("SESSION_NOT_FOUND");
    if (session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");
    if (session.expiresAt && session.expiresAt.getTime() < Date.now()) throw new Error("SESSION_EXPIRED");

    // must already be a participant (pre-joined via createSession)
    const participant = await tx.participant.findUnique({
      where: { sessionId_userId: { sessionId: roomId, userId: user.id } },
      select: { id: true },
    });
    if (!participant) throw new Error("NOT_PARTICIPANT");

  }); 
}

// ====== Websocket proxy gateway  ====== 
export function installCollabWsProxy(server: HttpServer) {
  server.on("upgrade", async (req, socket, head) => {
      const url = parseUrl(req.url || "", true);
      const segments = (url.pathname || "").split("/").filter(Boolean);

      // Only handle /collab/ws/:roomId
      if (!(segments.length >= 3 && segments[0] === "collab" && segments[1] === "ws")) return;

      try {
        const roomId = segments[2];
        if (!roomId) return rejectUpgrade(socket, 400, "Missing roomId");

        // Gather token from query, header or cookie
        let token: string | undefined = (url.query?.token as string) || undefined;

        // Authorization: Bearer ...
        if (!token && typeof req.headers.authorization === "string") {
          const h = req.headers.authorization;
          if (h.startsWith("Bearer ")) token = h.slice(7);
        }

        // Cookie 
        if (!token) {
          token = readJwtFromCookie(req);
        }

        console.log("[WS upgrade]", {
          path: url.pathname, roomId,
          hasToken: !!token,
          hasAuthHeader: !!req.headers.authorization,
          queryToken: !!url.query?.token,
          hasCookie: !!req.headers?.cookie,
        });

        if (!token) return rejectUpgrade(socket, 401, "Missing token");

        const user = verifyAccessToken(token);
        await authorize(roomId, user);

        // Rewrite path so upstream sees "/<roomId>"
        (req as any).url = `/${roomId}`;

        proxy.ws(req, socket, head);

      } catch (e: any) {
      const msg = e?.message || "Upgrade failed";
      const status = e?.status || (msg.includes("jwt") ? 401 : 403);
      console.error("[WS upgrade] failed:", msg);
      rejectUpgrade(socket, status, msg);
    }
  });
}