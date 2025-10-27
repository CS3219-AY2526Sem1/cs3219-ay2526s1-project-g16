import express from "express";
import {
  loginUser,
  createUser,
  getUser,
  refreshAccessToken,
  logout,
  updateUser,
} from "../controller/user-controller.ts";

const router = express.Router();

router.post("/register", createUser);

router.post("/login", loginUser);

router.get("/:id", getUser);

router.get("/", getUser);

router.post("/refresh", refreshAccessToken);

router.post("/logout", logout);

router.patch("/:id", updateUser);

export default router;
