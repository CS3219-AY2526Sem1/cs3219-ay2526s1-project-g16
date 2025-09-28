import express from "express";
import { requestMatch, getMatchStatus, cancelMatch } from "../controller/match-controller.ts";
// import { authenticateJWT } from "../middleware/access-control"; // if you have it

const router = express.Router();

// Create/find a match for the caller
router.post("/request", /*authenticateJWT,*/ requestMatch);

// Poll match status
router.get("/status/:userId", /*authenticateJWT,*/ getMatchStatus);

// Cancel ticket
router.post("/cancel", /*authenticateJWT,*/ cancelMatch);

export default router;
