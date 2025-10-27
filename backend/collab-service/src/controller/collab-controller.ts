import type { Request, Response } from "express";
import {
  createSession as _createSession,
  endSession as _endSession,
  getSession as _getSession,
  joinSession as _joinSession,
  leaveSession as _leaveSession,
  findMyActiveSession,
  sweepExpiredSessions,
  seedDocIfEmpty
} from "../model/collab-model.ts";

// GET /collab/session/active
export async function getMyActiveSession(req: Request, res: Response) {
  try {
    const me = req.user!; // remove this soon - change to cookies
    const session = await findMyActiveSession(me.id);
    return res.status(200).json({ data: session });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

export async function runSweeperNow(req: Request, res: Response) {
  try {
    const out = await sweepExpiredSessions();
    return res.status(200).json({ data: out });
  } catch (e) {
    return res.status(500).json({ error: "Internal server error" });
  }
}

// POST /collab/sessions
export async function createSession(req: Request, res: Response) {
  try {
    const { topic, difficulty, questionId, roomId, expiresAt } = req.body; // allow roomId from matcher (Jasper)
    if (!topic || !difficulty) {
      return res.status(400).json({ error: "topic and difficulty are required" });
    }
    // query from alicia

    // set up actual collab service
    const session = await _createSession(
      roomId,
      topic, 
      difficulty, 
      questionId,
      expiresAt ? new Date(expiresAt) : undefined
    );

    // seed the ydoc - not implemented yet, ignore for now
    // const id = session.id;
    // await seedDocIfEmpty(id, [
    //   `// Room: ${id}`,
    //   `// Topic: ${topic} | Difficulty: ${difficulty}`,
    //   ``,
    //   `function demo(){ console.log("Hello PeerPrep"); }`,
    //   `demo();`,
    //   ``,
    // ].join('\n'));
    
    return res.status(201).json({ data: session });
  } catch (e) {
    console.error("Error creating session:", e); 
    return res.status(500).json({ error: "Internal server error" });
  }
}

// POST /collab/sessions/:id/end 
export async function endSession(req: Request, res: Response) {
  try {
    const {id} = req.params;
    if (!id) return res.status(400).json({ error: "id is required" });
    const user = req.user!;
    
    const session = await _getSession(id);
    if (!session) return res.status(404).json({ error: "Session not found" });

    const ended = await _endSession(id);
    return res.status(200).json({ data: ended });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

// POST /collab/sessions/:id/join
export async function joinSession(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id is required" });
    const user = req.user!;
    if (!user.username) return res.status(400).json({ error: "username is required" });

    const session = await _joinSession(id, { id: user.id, username: user.username });
    if (!session) return res.status(404).json({ error: "Session not found or not active" });
    return res.status(200).json({ data: session });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

// POST /collab/sessions/:id/leave
export async function leaveSession(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id is required" });
    const user = req.user!;

    await _leaveSession(id, user.id);
    return res.status(200).json({ data: { left: true } });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

// GET /collab/sessions/:id
export async function getSession(req: Request, res: Response) {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id is required" });

    const session = await _getSession(id);
    if (!session) return res.status(404).json({ error: "Not found" });
    return res.status(200).json({ data: session });
  } catch {
    return res.status(500).json({ error: "Internal server error" });
  }
}

