import type { Request, Response } from "express";

export async function helloWorld(req: Request, res: Response): Promise<void> {
    try {
        const username = req.user?.username;
        res.status(400).json({ message: `hello ${username}` });
        return;
    } catch {
        res.status(500).json({ error: "Internal Server Error" });
        return;
    }
}