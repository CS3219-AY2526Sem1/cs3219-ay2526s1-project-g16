import type { Request, Response } from "express";
import {
  createSession as _createSession,
  endSession as _endSession,
  getSession as _getSession,
  joinSession as _joinSession,
  leaveSession as _leaveSession,
  findMyActiveSession,
  findActiveSessionByUsername,
  sweepExpiredSessions,
  seedDocIfEmpty
} from "../model/collab-model.ts";
import { decodeAccessToken, triggerSignal } from "./collab-utils.ts";

const USER_SERVICE_BASE = process.env.USER_SERVICE_URL ?? "http://user:3000"; 

// ====== Helpers ===== 

// Accepts both Authorisation Header (API to API) AND cookies
function extractAccessToken(req: Request): string | null {
  const h = req.headers.authorization;
  if (typeof h === "string" && h.startsWith("Bearer ")) return h.slice(7);
  if (req.cookies?.jwt_access_token) return req.cookies.jwt_access_token;
  return null;
}

async function fetchUsernameById(userId: string): Promise<string | null> {
  try {
    const resp = await fetch(`${USER_SERVICE_BASE}/user/${encodeURIComponent(userId)}`, { method: "GET" });
    if (!resp.ok) return null;
    const data = await resp.json();
    // depends on your user service response shape; adjust if needed
    const username = data?.username ?? data?.data?.username ?? data?.user?.username;
    return typeof username === "string" ? username : null;
  } catch {
    console.log("Collab error - fetch username by ID");
    return null;
  }
}

// ====== Endpoints ===== 

// POST /sessions/sweeper/run
export async function runSweeperNow(req: Request, res: Response) {
  try {
    const out = await sweepExpiredSessions();
    return res.status(200).json({ data: out });
  } catch (e) {
    return res.status(500).json({ error: "Internal server error: Collab sweeper error" });
  }
}

// GET /sessions/active
export async function getMyActiveSession(req: Request, res: Response) {
  try {
    const token = extractAccessToken(req);
    if (!token) return res.status(401).json({ error: "Unauthorized" });

    const decoded = decodeAccessToken(token);
    const session = await findMyActiveSession(decoded.sub); //decoded.sub == user id
    return res.status(200).json({ data: session }); // CollabSession or null
  } catch {
    return res.status(500).json({ error: "Internal server error: Cannot get active session." });
  }
}

// POST /sessions/active/username  (unauthenticated)
export async function getActiveSessionByUsername(req: Request, res: Response) {
  try {
    const raw = (req.body?.username ?? "").toString().trim();
    if (!raw) return res.status(400).json({ error: "username is required" });
    const username = raw;

    const session = await findActiveSessionByUsername(username);
    if (!session) return res.status(200).json({ data: null });

    return res.status(200).json({ data: session }); 
  } catch (e) {
    console.error("getActiveSessionByUsername error:", e);
    return res.status(500).json({ error: "Internal server error: Cannot get active session by username." });
  }
}

// POST /sessions
// Frontend should retrieve question based on session.questionId after joinSession
export async function createSession(req: Request, res: Response) {
  try {
    const { topic, difficulty, questionId, roomId, expiresAt, user1ID, user2ID, id } = req.body; 
  
    const session = await _createSession(
      roomId,
      topic, 
      difficulty, 
      questionId,
      expiresAt ? new Date(expiresAt) : undefined
    );
    console.log(`[DEBUG] Sending roomId: ${id}`);

    // upsert both users - _joinSession
    if (user1ID) {
      try {
        const user1Name = (await fetchUsernameById(user1ID)) ?? "";
        await _joinSession(session.id, { id: user1ID, username: user1Name });
        console.log(`[DEBUG] Sending roomId: ${roomId}`);
        await triggerSignal(user1ID, roomId);
      } catch (e) {
        console.warn("joinSession failed for user1:", e);
      }
    }

    // upsert second user
    if (user2ID) {
      try {
        const user2Name = (await fetchUsernameById(user2ID)) ?? "";
        await _joinSession(session.id, { id: user2ID, username: user2Name });
        console.log(`[DEBUG] Sending roomId: ${roomId}`);
        await triggerSignal(user2ID, roomId);
      } catch (e) {
        console.warn("joinSession failed for user2:", e);
      }
    }

    const fresh = await _getSession(session.id);

    return res.status(201).json({ data: { fresh } });
  } catch (e) {
    console.error("Error creating session:", e); 
    return res.status(500).json({ error: "Internal server error: Session creation error." });
  }
}

// POST /sessions/:id/end 
export async function endSession(req: Request, res: Response) {
  try {
    const {id} = req.params;
    if (!id) return res.status(400).json({ error: "id is required" });
    
    const session = await _getSession(id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const ended = await _endSession(id);
    return res.status(200).json({ data: ended });
  } catch {
    return res.status(500).json({ error: "Internal server error: Session ending error." });
  }
}

// POST /sessions/:id/join
export async function joinSession(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id is required" });
    
    const decoded = decodeAccessToken(req.cookies.jwt_access_token);
    if (!decoded.username) return res.status(400).json({ error: "username is required" });

    const session = await _joinSession(id, { id: decoded.sub, username: decoded.username });
    if (!session) return res.status(404).json({ error: "Session not found or not active" });
    return res.status(200).json({ data: session });
  } catch {
    return res.status(500).json({ error: "Internal server error: Session joining error." });
  }
}

// POST /sessions/:id/leave
export async function leaveSession(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id is required" });
    const decoded = decodeAccessToken(req.cookies.jwt_access_token);

    await _leaveSession(id, decoded.sub);
    return res.status(200).json({ data: { left: true } });
  } catch {
    return res.status(500).json({ error: "Internal server error: Session leaving error." });
  }
}

// GET /sessions/:id
export async function getSession(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id is required" });

    const session = await _getSession(id);
    if (!session) return res.status(404).json({ error: "Not found" });
    return res.status(200).json({ data: session });
  } catch {
    return res.status(500).json({ error: "Internal server error: Session retrieval error." });
  }
}

