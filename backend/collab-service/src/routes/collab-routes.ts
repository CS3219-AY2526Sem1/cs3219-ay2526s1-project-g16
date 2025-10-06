import express from "express";
import { authenticateJWT } from "shared-middleware";
import {
  createSession,
  joinSession,
  leaveSession,
  endSession,
  getSession
} from "../controller/collab-controller.ts";

const router = express.Router();

router.post("/sessions", authenticateJWT, createSession);

router.post("/sessions/:id/end", authenticateJWT, endSession);

router.get("/sessions/:id", authenticateJWT, getSession);

router.post("/sessions/:id/join", authenticateJWT, joinSession);

router.post("/sessions/:id/leave", authenticateJWT, leaveSession);

export default router;
