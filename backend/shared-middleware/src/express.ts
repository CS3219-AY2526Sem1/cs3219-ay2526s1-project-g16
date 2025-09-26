import "express";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: {
        id: string;
        username?: string;
        email?: string;
        isAdmin?: boolean;
      };
    }
  }
}

export {};
