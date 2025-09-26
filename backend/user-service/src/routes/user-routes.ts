import express from "express";
import {
  loginUser,
  createUser,
  getUser,
} from "../controller/user-controller.ts";
import { authenticateJWT } from "shared-middleware";

const router = express.Router();

router.post("/register", createUser);

router.post("/login", loginUser);

router.get("/:id", authenticateJWT, getUser);

export default router;
