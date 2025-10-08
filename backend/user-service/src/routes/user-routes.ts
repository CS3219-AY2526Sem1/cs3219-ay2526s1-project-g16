import express from "express";
import {
  loginUser,
  createUser,
  getUser,
  refreshAccessToken,
  logout,
  updateUser,
} from "../controller/user-controller.ts";
import { authenticateJWT } from "shared-middleware";

const router = express.Router();

router.post("/register", createUser);

router.post("/login", loginUser);

router.get("/:id", authenticateJWT, getUser);

router.get("/", authenticateJWT, getUser);

router.post("/refresh", refreshAccessToken);

router.post("/logout", logout);

router.post("/update/:id", authenticateJWT, updateUser);

export default router;
