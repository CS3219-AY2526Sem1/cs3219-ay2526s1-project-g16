import { Router } from "express";
import { listLanguagesHandler } from "../controllers/language-controller.ts";

const router = Router();

// GET /api/languages
router.get("/", listLanguagesHandler);

export default router;
