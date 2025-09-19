import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import {
    getUserById as _getUserById
} from '../model/user-model.ts';

export async function authenticateJWT(req: Request, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  const access_token = authHeader.split(' ')[1];
  if (!access_token) {
    res.status(401).json({ error: 'Unauthorized: No token provided' });
    return;
  }

  try {
    const secret = process.env.JWT_SECRET;
      if (!secret) {
        throw new Error('JWT_SECRET is not defined in the environment variables');
      }
    const decoded = jwt.verify(access_token, secret);

    const userId = decoded.sub as string;

    // check user exists
    const existingUser = await _getUserById(userId);
    if (!existingUser) {
        res.status(401).json({ error: 'Unauthorized: User does not exist.' });
    }

    // Add user info to request object
    req.user = {
        id: existingUser?.id as string ,
        email: existingUser?.email as string, 
        isAdmin: existingUser?.isAdmin as boolean
    };

    next(); // Proceed to next middleware or route handler
  } catch (err) {
    res.status(401).json({ error: 'Unauthorized: Invalid or expired token' });
    return
  }
}