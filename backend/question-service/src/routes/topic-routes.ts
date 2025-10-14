import { Router } from "express";
import { listTopicsHandler } from "../controllers/topics-controller.ts";

const router = Router();

// GET /api/topics
router.get("/", listTopicsHandler);

export default router;
