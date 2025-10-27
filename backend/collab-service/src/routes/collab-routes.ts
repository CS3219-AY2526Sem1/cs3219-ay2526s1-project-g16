import express from "express";
import { authenticateJWT } from "shared-middleware";
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

router.get("/sessions/active",authenticateJWT, getMyActiveSession);

router.post("/sessions", authenticateJWT, createSession);

router.post("/sessions/:id/end", authenticateJWT, endSession);

router.get("/sessions/:id", authenticateJWT, getSession);

router.post("/sessions/:id/join", authenticateJWT, joinSession);

router.post("/sessions/:id/leave", authenticateJWT, leaveSession);

router.post("/sessions/sweeper/run", runSweeperNow);

export default router;
