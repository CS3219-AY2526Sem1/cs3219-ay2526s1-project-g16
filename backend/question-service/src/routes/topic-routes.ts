import { Router } from "express";
import { listTopicsHandler, hardDeleteTopicHandler } from "../controllers/topics-controller.ts";
import { asyncHandler } from "../middlewares/asyncHandler.ts";

const router = Router();

// GET /topics
router.get("/", listTopicsHandler);
router.delete("/hard/:id", asyncHandler(hardDeleteTopicHandler));

export default router;
