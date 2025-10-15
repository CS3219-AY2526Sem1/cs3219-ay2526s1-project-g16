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

router.post("/sessions", createSession);

router.post("/sessions/:id/end", endSession);

router.get("/sessions/:id", getSession);

router.post("/sessions/:id/join", joinSession);

router.post("/sessions/:id/leave", leaveSession);

export default router;
