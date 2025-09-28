import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
const { TokenExpiredError } = jwt;
import type { JwtPayload } from "jsonwebtoken";
export * from "./express.js";

export interface MyJwtPayload extends JwtPayload {
  username: string;
  email: string;
  isAdmin: boolean;
}

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
    const decoded = jwt.verify(accessToken, accessSecret) as MyJwtPayload;

    // Add user info to request object
    req.user = {
      id: decoded.sub as string,
      username: decoded.username as string,
      email: decoded.email as string,
      isAdmin: decoded.isAdmin as boolean,
    };

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
