import type { Response } from "express";
import jwt from "jsonwebtoken";
import type { User } from "../generated/prisma/index.js";

export const ACCESS_TOKEN_EXPIRES_IN = "1m"; // JWT expiration format
export const REFRESH_TOKEN_EXPIRES_IN = "1d";

export const ACCESS_TOKEN_MAX_AGE = 60 * 1000; // 1 min seconds in ms
export const REFRESH_TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 1 day in ms

export function generateAccessToken(
  id: string,
  username: string,
  email: string,
  isAdmin: boolean,
  secret: string,
) {
  const payload = {
    sub: id,
    username: username,
    email: email,
    isAdmin: isAdmin,
  };
  return jwt.sign(payload, secret, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

export function generateRefreshToken(
  id: string,
  username: string,
  email: string,
  isAdmin: boolean,
  secret: string,
) {
  const payload = {
    sub: id,
    username: username,
    email: email,
    isAdmin: isAdmin,
  };
  return jwt.sign(payload, secret, { expiresIn: REFRESH_TOKEN_EXPIRES_IN });
}

export async function updateCookieAccessToken(res: Response, token: string) {
  res.cookie("jwt_access_token", token, {
    httpOnly: true,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
}

export async function updateCookieRefreshToken(res: Response, token: string) {
  res.cookie("jwt_refresh_token", token, {
    httpOnly: true,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export function formatUserResponse(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}
