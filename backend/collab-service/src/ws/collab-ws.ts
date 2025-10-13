import { Server as HttpServer } from "http";
import { parse as parseUrl } from "url";
import jwt from "jsonwebtoken";
import { prisma } from "../model/collab-model.ts";
import { createRequire } from "module";

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
  const session = await prisma.collabSession.findUnique({ where: { id: roomId } });
  
  if (!session) throw new Error("SESSION_NOT_FOUND");
  if (session.status !== "ACTIVE") throw new Error("SESSION_NOT_ACTIVE");

  await prisma.participant.upsert({
    where: { sessionId_userId: { sessionId: roomId, userId: user.id } },
    update: { leftAt: null, username: user.username ?? "" },
    create: { sessionId: roomId, userId: user.id, username: user.username ?? "" },
  });
}

const TARGET_WS = "ws://127.0.0.1:1234";
const proxy = httpProxy.createProxyServer({ target: TARGET_WS, ws: true, changeOrigin: true });

// log proxy errors (e.g., upstream not running)
proxy.on("error", (err: any, _req: any, socket: any) => {
  console.error("[WS proxy] error:", err?.code || err?.message || err);
  try { socket?.destroy(); } catch {}
});

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

/* CLIENT SIDE CODE */
//import * as Y from 'yjs'
// import { WebsocketProvider } from 'y-websocket'

// // Your collab gateway URL (it proxies to the upstream server)
// const serverUrl = 'ws://localhost:3009/collab/ws'
// const roomId = '2'                // same as your CollabSession.id
// const token  = '<ACCESS_JWT>'     // from your app auth

// const doc = new Y.Doc()
// const provider = new WebsocketProvider(serverUrl, roomId, doc, {
//   params: { token },              // your gateway checks this
// })

// // Example shared text
// const ytext = doc.getText('code')

// // bind ytext to your editor (Monaco/CodeMirror) or a textarea
// ytext.observe(() => {
//   console.log('Doc content:', ytext.toString())
// })

/* 
EXPLANATION FOR CLIENT SIDE CODE

 Clients connects to ws://localhost:3009/collab/ws/2?token=...

 The actual Yjs document lives in the clients:
Each client creates a new Y.Doc().
They connect with new WebsocketProvider(<your /collab/ws>, roomId, doc, { params: { token } }).
They operate on shared structures (e.g. doc.getText("code")).
The upstream @y/websocket-server just relays/persists updates; it doesn’t hold your business logic.
 Yjs merges concurrent edits and propagates them. You don’t write any “insert/delete op” logic

 docName = roomId
 doc.getText("code or whatever") --> to operate
 docName = your roomId; params.token = the same JWT string.


*/