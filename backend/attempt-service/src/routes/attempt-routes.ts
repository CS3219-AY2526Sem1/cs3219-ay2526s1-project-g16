import express from "express";
import { addAttempt, getAttemptsByUserId, getUniqueQuestionsByUserId } from "../controller/attempt-controller.ts";

const router = express.Router();

router.post("/", addAttempt);

router.get('/user/:id', getAttemptsByUserId);

router.get('/:id', getAttemptsByUserId);

router.get('/unique-qns/:id', getUniqueQuestionsByUserId);

export default router;
