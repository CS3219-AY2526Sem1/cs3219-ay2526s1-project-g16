import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import type { JwtPayload } from "jsonwebtoken";
export * from "./express.js";

export async function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    res.status(401).json({ error: "Unauthorized: No token provided" });
    return;
  }

  const access_token = authHeader.split(" ")[1];
  if (!access_token) {
    res.status(401).json({ error: "Unauthorized: No token provided" });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      throw new Error("JWT_SECRET is not defined in the environment variables");
    }
    interface MyJwtPayload extends JwtPayload {
      username: string;
      email: string;
      isAdmin: boolean;
    }
    const decoded = jwt.verify(access_token, secret) as MyJwtPayload;

    // Add user info to request object
    req.user = {
      id: decoded.sub as string,
      username: decoded.username as string,
      email: decoded.email as string,
      isAdmin: decoded.isAdmin as boolean,
    };

    next(); // Proceed to next middleware or route handler
  } catch {
    res.status(401).json({
      error: "Unauthorized: Invalid or expired token",
    });
    return;
  }
}
