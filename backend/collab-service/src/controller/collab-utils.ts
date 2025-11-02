import jwt from "jsonwebtoken";
import type { JwtPayload } from 'jsonwebtoken';

export interface CustomJwtPayload extends JwtPayload {
  sub: string;
  username: string;
  email: string;
  isAdmin: boolean;
}

const ACCESS_SECRET = process.env.ACCESS_JWT_SECRET || "access-secret";

export function decodeAccessToken(token: string): CustomJwtPayload {
  try {
    const decoded = jwt.verify(token, ACCESS_SECRET) as JwtPayload;

    if (
      typeof decoded.sub !== 'string' ||
      typeof (decoded as any).username !== 'string' ||
      typeof (decoded as any).email !== 'string' ||
      typeof (decoded as any).isAdmin !== 'boolean'
    ) {
      throw new Error("Invalid token payload structure.");
    }

    return decoded as CustomJwtPayload;
  } catch (err) {
    // Optionally rethrow or handle/log
    throw new Error(`Invalid token: ${(err as Error).message}`);
  }
}

const MATCHING_URL = "http://matching:3001";

async function triggerSignal(userId: string) {
  try {
    const res = await fetch(`${MATCHING_URL}/signal/${userId}`, {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });

    if (!res.ok) {
      console.error(`Failed: ${res.status} ${res.statusText}`);
      const text = await res.text();
      console.error(text);
      return;
    }

    const data = await res.json();
    console.log("Signal sent:", data);
  } catch (err) {
    console.error("Error triggering signal:", err);
  }
}