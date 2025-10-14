import express from "express";
import { helloWorld, addAttempt, getAttemptsByUserId, getUniqueQuestionsByUserId } from "../controller/attempt-controller.ts";
import { authenticateJWT } from "shared-middleware";

const router = express.Router();

router.get("/", authenticateJWT, helloWorld);

router.post("/", authenticateJWT, addAttempt);

router.get('/:userId', authenticateJWT, getAttemptsByUserId);

router.get('/unique-qns/:userId', getUniqueQuestionsByUserId);

export default router;
