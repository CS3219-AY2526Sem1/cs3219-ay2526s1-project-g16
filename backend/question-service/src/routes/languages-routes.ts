import { Router } from "express";
import { listLanguagesHandler } from "../controllers/language-controller.ts";
import { asyncHandler } from "../middlewares/asyncHandler.ts";

const router = Router();

// GET /languages
router.get("/", asyncHandler(listLanguagesHandler));

export default router;
