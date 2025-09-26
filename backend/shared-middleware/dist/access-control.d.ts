import type { Request, Response, NextFunction } from "express";
export * from "./express.js";
export declare function authenticateJWT(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void>;
//# sourceMappingURL=access-control.d.ts.map
