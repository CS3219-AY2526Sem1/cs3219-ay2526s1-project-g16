import express from "express";
import { requestMatch, getMatchStatus, cancelMatch } from "../controller/match-controller.ts";
import { subscribeMatchSSE } from "../controller/match-SSE.ts";

const router = express.Router();

router.post("/request", /*authenticateJWT,*/ requestMatch);

router.get("/status/:userId", /*authenticateJWT,*/ getMatchStatus);

router.post("/cancel", /*authenticateJWT,*/ cancelMatch);

router.get("/subscribe/:userId", subscribeMatchSSE);

export default router;
