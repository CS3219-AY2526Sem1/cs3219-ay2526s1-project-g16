import "express";
declare global {
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
//# sourceMappingURL=express.d.ts.map