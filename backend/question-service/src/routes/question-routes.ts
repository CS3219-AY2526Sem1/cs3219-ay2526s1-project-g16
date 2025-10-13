import { Router } from "express";
import { asyncHandler } from "../middlewares/asyncHandler.ts";
import {
  createQuestionHandler,
  getQuestionHandler,
  listQuestionsHandler,
  updateQuestionHandler,
  deleteQuestionHandler,
} from "../controllers/question-controller.ts";

const router = Router();

/**
 * Routes:
 * GET    /api/questions           -> list (filters: search, topicNames, difficulty, orderBy, skip, take)
 * GET    /api/questions/:id       -> get by id
 * POST   /api/questions           -> create
 * PATCH  /api/questions/:id       -> update (partial)
 * DELETE /api/questions/:id       -> delete
 */
router.get("/", asyncHandler(listQuestionsHandler));
router.get("/:id", asyncHandler(getQuestionHandler));
router.post("/", asyncHandler(createQuestionHandler));
router.patch("/:id", asyncHandler(updateQuestionHandler));
router.delete("/:id", asyncHandler(deleteQuestionHandler));

export default router;
