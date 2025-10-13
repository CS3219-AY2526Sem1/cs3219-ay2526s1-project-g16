import type { Request, Response, NextFunction } from "express";
import type { JwtPayload } from "jsonwebtoken";
export * from "./express.js";
export interface MyJwtPayload extends JwtPayload {
  username: string;
  email: string;
  isAdmin: boolean;
}
export declare function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void>;
//# sourceMappingURL=access-control.d.ts.map
