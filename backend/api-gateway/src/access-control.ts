import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
const { TokenExpiredError } = jwt;

export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accessToken = req.cookies?.jwt_access_token;
  if (!accessToken) {
    res.status(401).json({ error: "Unauthorized: No access token provided" });
    return;
  }

  try {
    const accessSecret = process.env.ACCESS_JWT_SECRET;
    if (!accessSecret) {
      throw new Error("ACCESS_JWT_SECRET is not defined");
    }
    jwt.verify(accessToken, accessSecret);

    next(); // Proceed to next middleware or route handler
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      res.status(401).json({
        error: "Unauthorized: Expired access token",
      });
      return;
    }

    res.status(401).json({
      error: "Unauthorized: Invalid token" + err,
    });
    return;
  }
}

export async function authorizeJWT(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accessToken = req.cookies?.jwt_access_token;

  if (!accessToken) {
    res.status(401).json({ error: "Unauthorized: No access token provided" });
    return;
  }

  try {
    const accessSecret = process.env.ACCESS_JWT_SECRET;
    if (!accessSecret) {
      throw new Error("ACCESS_JWT_SECRET is not defined");
    }

    // Verify and decode token
    const decoded = jwt.verify(accessToken, accessSecret);

    // Extract user ID from token (sub) and from URL param
    const tokenUserId = decoded.sub;
    const userId = req.params.id;

    if (!userId) {
      res.status(400).json({ error: "Unauthorized: Missing userId in route params" });
      return;
    }

    if (tokenUserId !== userId) {
      res.status(403).json({
        error: "Unauthorized: Token does not match userId in URL",
      });
      return;
    }

    next();
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      res.status(401).json({ error: "Unauthorized: Expired access token" });
    } else {
      res.status(401).json({ error: "Unauthorized: Invalid token" });
    }
  }
}