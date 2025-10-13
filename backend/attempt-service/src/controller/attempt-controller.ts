import type { Request, Response } from "express";
import type { attempt } from '../generated/prisma/index.js';
import {
  addAttempt as _addAttempt,
  getAttemptsByUsername as _getAttemptsByUsername,
  getUniqueQuestionsByUsername as _getUniqueQuestionsByUsername,
} from '../model/attempt.ts';

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

export async function addAttempt(req: Request, res: Response): Promise<void> {
  try {
    const { username, matchUsername, question, code } = req.body;

    if (req.user?.username != username) {
      res.status(401).json({ error: 'Unauthorized to add this attempt.' });
      return;
    }

    if (
      typeof username !== 'string' ||
      typeof matchUsername !== 'string' ||
      typeof question !== 'number' ||
      typeof code !== 'string'
    ) {
      res.status(400).json({ error: 'Invalid input' });
      return;
    }

    const newAttempt: attempt = await _addAttempt(
      username,
      matchUsername,
      question,
      code,
    );

    res.status(201).json({ message: 'Attempt created' });
    return;
  } catch (error) {
    res.status(500).json({ error: 'Internal server error' });
    return;
  }
}
