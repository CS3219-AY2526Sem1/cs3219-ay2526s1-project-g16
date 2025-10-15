import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
const { TokenExpiredError } = jwt;

export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const accessToken = req.cookies?.jwt_access_token;
  console.log("Checking token");
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
