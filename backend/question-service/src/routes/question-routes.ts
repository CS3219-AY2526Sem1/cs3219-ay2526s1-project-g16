import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.ts";
import {
  createQuestionHandler,
  getQuestionHandler,
  listQuestionsHandler,
  updateQuestionHandler,
  deleteQuestionHandler,
  hardDeleteQuestionHandler,
} from "../controllers/question-controller.ts";

const router = Router();

/**
 * Routes:
 * GET    /questions           -> list (filters: search, topicNames, difficulty, orderBy, skip, take)
 * GET    /questions/:id       -> get by id
 * POST   /questions           -> create
 * PATCH  /questions/:id       -> update (soft-delete)
 * DELETE /questions/hard/:id  -> hard delete
 */
router.get("/", asyncHandler(listQuestionsHandler));
router.get("/:id", asyncHandler(getQuestionHandler));
router.post("/", asyncHandler(createQuestionHandler));
router.patch("/:id", asyncHandler(updateQuestionHandler));
router.delete("/:id", asyncHandler(deleteQuestionHandler));
router.delete("/hard/:id", asyncHandler(hardDeleteQuestionHandler));

export default router;
