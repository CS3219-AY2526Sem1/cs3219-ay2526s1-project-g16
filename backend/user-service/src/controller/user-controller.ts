import bcrypt from "bcrypt";
import jwt from 'jsonwebtoken';
import type { Request, Response } from 'express';
import {
    createUser as _createUser,
    getUserByEmail as _getUserByEmail,
    getUserById as _getUserById,
    getUserByUsername as _getUserByUsername
} from '../model/user-model.ts';
import type { User } from '../generated/prisma/index.js';

export async function loginUser(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;

  if (email && password) {
    try {
      // Check if user exists
      const existingUser = await _getUserByEmail(email);
      if (!existingUser) {
        res.status(401).json({ error: 'Invalid email address.' });
        return;
      }

      // check password matches
      const isPasswordCorrect = await bcrypt.compare(password, existingUser.passwordHash);
      if (!isPasswordCorrect) {
        res.status(401).json({ error: 'Password is wrong.' });
        return;
      }

      // generate access token
      const payload = { sub: existingUser.id };
      const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables');
      }
      const accessToken = jwt.sign(payload, secret, { expiresIn: "1d", });
      res.status(200).json({ data: { accessToken, ...formatUserResponse(existingUser) } });
      return;

    } catch (error) {
      res.status(500).json({ error: 'Internal server error.' });
    }
  } else {
    res.status(400).json({ error: 'Missing email or password.' });
  }
}

export async function createUser(req: Request, res: Response): Promise<void> {
  try {
    const { username, email, password } = req.body;

    // Basic validation
    if (!username || username.length < 3) {
      res.status(400).json({ error: 'Username must be at least 3 characters long.' });
      return;
    }

    if (!email || email.length < 3) {
      res.status(400).json({ error: 'Email must be at least 3 characters long.' });
      return;
    }

    if (!password || password.length < 3) {
      res.status(400).json({ error: 'Password must be at least 3 characters long.' });
      return;
    }

    // Check for duplicate username or email
    const existingUserByUsername = await _getUserByUsername(username);
    if (existingUserByUsername) {
      res.status(409).json({ error: 'Username is already taken.' });
      return;
    }

    const existingUserByEmail = await _getUserByEmail(email);
    if (existingUserByEmail) {
      res.status(409).json({ error: 'An account with this email already exists.' });
      return;
    }

    // Hash the password (required!)
    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const newUser = await _createUser(username, email, passwordHash);

    res.status(201).json(formatUserResponse(newUser));
  } catch (error) {
    console.error('Error creating user:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
}

export async function getUser(req: Request, res: Response): Promise<void> {
  try {
    const userId = req.params.id as string;
    const existingUser = await _getUserById(userId);
    if (!existingUser) {
      res.status(404).json({ error: `User ${userId} not found` });
      return;
    }
    res.status(200).json({ data: formatUserResponse(existingUser) });
    return;
  } catch (err) {
    res.status(500).json({ error: "Internal Server Error" });
    return;
  }
}

export function formatUserResponse(user: User) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    isAdmin: user.isAdmin,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}