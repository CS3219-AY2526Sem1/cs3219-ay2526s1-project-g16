import express from "express";
import { addAttempt, getAttemptsByUserId, getUniqueQuestionsByUserId, getAttempt } from "../controller/attempt-controller.ts";

const router = express.Router();

router.post("/", addAttempt);

router.get('/user/:id', getAttemptsByUserId);

router.get('/:id', getAttempt);

router.get('/unique-qns/:id', getUniqueQuestionsByUserId);

export default router;
