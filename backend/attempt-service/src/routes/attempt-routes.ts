import express from "express";
import {
  helloWorld,
} from "../controller/attempt-controller.ts";
import { authenticateJWT } from "shared-middleware";

const router = express.Router();

router.get("/", authenticateJWT, helloWorld);

export default router;
