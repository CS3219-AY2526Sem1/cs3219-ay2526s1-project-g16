import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import type { Request, Response } from "express";
import {
  createUser as _createUser,
  getUserByEmail as _getUserByEmail,
  getUserById as _getUserById,
  getUserByUsername as _getUserByUsername,
} from "../model/user.ts";
import type { User } from "../generated/prisma/index.js";
import {
  addRefreshToken as _addRefreshToken,
  isRefreshToken as _isRefreshToken,
  removeRefreshToken as _removeRefreshToken,
  getRefreshToken as _getRefreshToken,
} from "../model/refresh-token.ts";
import {
  generateAccessToken,
  generateRefreshToken,
  updateCookieAccessToken,
  updateCookieRefreshToken,
  REFRESH_TOKEN_MAX_AGE,
  formatUserResponse,
} from "./controller-utils.ts";
import type { MyJwtPayload } from "shared-middleware";

const ACCESS_SECRET = process.env.ACCESS_JWT_SECRET || "access-secret";
const REFRESH_SECRET = process.env.REFRESH_JWT_SECRET || "refresh-secret";

export async function loginUser(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (email && password) {
    try {
      // Check if user exists
      const existingUser: User | null = await _getUserByEmail(email);
      if (!existingUser) {
        res.status(401).json({ error: "Invalid email address." });
        return;
      }

      // check password matches
      const isPasswordCorrect = await bcrypt.compare(
        password,
        existingUser.passwordHash,
      );
      if (!isPasswordCorrect) {
        res.status(401).json({ error: "Password is wrong." });
        return;
      }

      // generate access token and refresh token
      const accessToken = generateAccessToken(
        existingUser.id,
        existingUser.username,
        existingUser.email,
        existingUser.isAdmin,
        ACCESS_SECRET,
      );
      const refreshToken = generateRefreshToken(
        existingUser.id,
        existingUser.username,
        existingUser.email,
        existingUser.isAdmin,
        REFRESH_SECRET,
      );
      await _addRefreshToken(
        refreshToken,
        new Date(Date.now() + REFRESH_TOKEN_MAX_AGE),
      );
      await updateCookieAccessToken(res, accessToken);
      await updateCookieRefreshToken(res, refreshToken);
      res.status(200).json(formatUserResponse(existingUser));
      return;
    } catch (err) {
      res.status(500).json({ error: "Internal server error." + err });
    }
  } else {
    res.status(400).json({ error: "Missing email or password." });
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || username.length < 3) {
      res.status(400).json({
        error: "Username must be at least 3 characters long.",
      });
      return;
    }

    if (!email || email.length < 3) {
      res.status(400).json({
        error: "Email must be at least 3 characters long.",
      });
      return;
    }

    if (!password || password.length < 3) {
      res.status(400).json({
        error: "Password must be at least 3 characters long.",
      });
      return;
    }

    // Check for duplicate username or email
    const existingUserByUsername = await _getUserByUsername(username);
    if (existingUserByUsername) {
      res.status(409).json({ error: "Username is already taken." });
      return;
    }

    const existingUserByEmail = await _getUserByEmail(email);
    if (existingUserByEmail) {
      res.status(409).json({
        error: "An account with this email already exists.",
      });
      return;
    }

    // Hash the password (required!)
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const newUser = await _createUser(username, email, passwordHash);

    res.status(201).json(formatUserResponse(newUser));
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getUser(req: Request, res: Response): Promise<void> {
  try {
    // For requests have passed through authenticateJWT middleware, you can access req.user as such:
    // console.log(
    //     req.user?.email + ", " + req.user?.username + "," + req.user?.email,
    // );
    let userId = req.params.id;
    if (!userId) {
      userId = req.user?.id;
    }
    const existingUser = await _getUserById(userId as string);
    if (!existingUser) {
      res.status(404).json({ error: `User ${userId} not found` });
      return;
    }
    res.status(200).json(formatUserResponse(existingUser));
    return;
  } catch {
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
}

export async function logout(req: Request, res: Response): Promise<void> {
  try {
    if (await _removeRefreshToken(req.cookies.jwt_refresh_token)) {
      updateCookieAccessToken(res, "");
      updateCookieRefreshToken(res, "");
      res.status(200).json({ message: "User logged out" });
      return;
    }
    res.status(500).json({
      message:
        "Could not logout user. The user's refresh token does not exist.",
    });
    return;
  } catch (err) {
    res.status(500).json({ message: "Could not logout user" + err });
    return;
  }
}

export async function refreshAccessToken(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    const refreshToken = req.cookies?.jwt_refresh_token;
    if (!refreshToken) {
      res.status(401).json({ message: "Refresh token missing" });
      return;
    }

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, REFRESH_SECRET) as MyJwtPayload;

    const existingUser = await _getUserByUsername(decoded.username);
    if (!existingUser) {
      res.status(401).json({ message: "Refresh does not match user" });
      return;
    }

    // Check if refresh token is stored
    const existingRefreshToken = await _getRefreshToken(refreshToken);
    if (!existingRefreshToken || existingRefreshToken.expiresAt < new Date()) {
      res.status(403).json({ message: "Invalid refresh token" });
      return;
    }

    // Generate new access token
    const accessToken = generateAccessToken(
      existingUser.id,
      existingUser.username,
      existingUser.email,
      existingUser.isAdmin,
      ACCESS_SECRET,
    );
    await updateCookieAccessToken(res, accessToken);
    res.status(200).json({ message: "Access token refreshed" });
    return;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({ message: "Refresh token expired" });
      return;
    }
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({ message: "Invalid Refresh token" });
      return;
    }
    res.status(500).json({ message: "Internal server error" });
  }
}
