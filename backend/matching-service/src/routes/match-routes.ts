import express from "express";
import { requestMatch, getMatchStatus, cancelMatch, subscribeMatchSSE } from "../controller/match-controller.ts";
// import { authenticateJWT } from "shared-middleware";

const router = express.Router();

router.post("/request", /*authenticateJWT,*/ requestMatch);

router.get("/status/:userId", /*authenticateJWT,*/ getMatchStatus);

router.post("/cancel", /*authenticateJWT,*/ cancelMatch);

router.get("/subscribe/:userId", subscribeMatchSSE);

export default router;
