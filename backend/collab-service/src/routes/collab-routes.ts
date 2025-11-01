import express from "express";
import {
  createSession,
  joinSession,
  leaveSession,
  endSession,
  getSession,
  getMyActiveSession,
  runSweeperNow
} from "../controller/collab-controller.ts";

const router = express.Router();

router.get("/sessions/active", getMyActiveSession);

router.post("/sessions", createSession);

router.post("/sessions/:id/end", endSession);

router.get("/sessions/:id", getSession);

router.post("/sessions/:id/join", joinSession);

router.post("/sessions/:id/leave", leaveSession);

router.post("/sessions/sweeper/run", runSweeperNow);

router.get('/healthz', (_req, res) => res.status(200).send('ok'));

export default router;
