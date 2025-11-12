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
import { decodeAccessToken } from "./collab-utils.ts";

const USER_SERVICE_BASE = process.env.USER_SERVICE_URL ?? "http://user:3000"; 

// ====== Helpers ===== 

function normalizeLanguage(input: unknown): "java" | "python" {
  const v = String(input || "").toLowerCase();
  return v === "java" ? "java" : "python"; 
}

// Accepts both Authorisation Header AND cookies
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

function templateFor(lang: "python" | "java"): string {
  if (lang === "java") {
    return `// Java
import java.io.*;
import java.util.*;

public class Main {
  public static void main(String[] args){
    System.out.println("hello");
  }
}`;
  }
  // default python
  return `# Python
def solve():
    # write your solution
    pass

if __name__ == "__main__":
    print("hello")`;
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
    if (!token) return res.status(401).json({ error: "[collab-controller] Unauthorized" });

    const decoded = decodeAccessToken(token);
    console.log("[collab-controller] User's id is", decoded.sub); // this works

    const session = await findMyActiveSession(decoded.sub); 
    return res.status(200).json({ data: session }); // CollabSession or null
  } catch {
    return res.status(500).json({ error: "Internal server error: Cannot get active session." });
  }
}

// POST /sessions/active/username  (unauthenticated)
export async function getActiveSessionByUsername(req: Request, res: Response) {
  try {
    const raw = (req.body?.username ?? "").toString().trim();
    if (!raw) return res.status(400).json({ error: "[collab-controller] username is required" });
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
export async function createSession(req: Request, res: Response) {
  try {
    const { topic, difficulty, questionId, id, expiresAt, user1ID, user2ID, language } = req.body; 
    const lang = normalizeLanguage(language);
    
    // Create collab session
    const session = await _createSession(
      id,
      topic, 
      difficulty, 
      questionId,
      expiresAt ? new Date(expiresAt) : undefined,
      lang
    );

    try {
      await seedDocIfEmpty(session.id, templateFor(lang));
    } catch (e) {
      console.error("[seedDocIfEmpty] failed (likely already seeded):", e);
    }

    // Upsert - user1 join
    if (user1ID) {
      try {
        const user1Name = (await fetchUsernameById(user1ID)) ?? "";
        await _joinSession(session.id, { id: user1ID, username: user1Name });
        // await triggerSignal(user1ID, session.id);
      } 
      
      catch (e: any) {
        if (e?.code === "P2002") {
          const existing = await findMyActiveSession(user1ID);
          return res.status(409).json({
            error: "User already in an active session",
            data: { userId: user1ID, existingSessionId: existing?.id ?? null },
          });
        }
        console.error("[joinSession failed for user1:", e);
        return res.status(500).json({ error: "Internal server error: user1 join failed." });
      }
    }

    // Upsert - user2 join
    if (user2ID) {
      try {
        const user2Name = (await fetchUsernameById(user2ID)) ?? "";
        await _joinSession(session.id, { id: user2ID, username: user2Name });
        // await triggerSignal(user2ID, session.id);
      } catch (e: any) {
        if (e?.code === "P2002") {
          const existing = await findMyActiveSession(user2ID);
          return res.status(409).json({
            error: "User already in an active session",
            data: { userId: user2ID, existingSessionId: existing?.id ?? null },
          });
        }
        console.error("joinSession failed for user2:", e);
        return res.status(500).json({ error: "Internal server error: user2 join failed." });
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

