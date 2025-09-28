import { prisma } from "./prisma-client.ts";
import type { RefreshToken } from "../generated/prisma/index.js";

export const addRefreshToken = async (
  token: string,
  expiresAt: Date,
): Promise<RefreshToken> => {
  return await prisma.refreshToken.create({
    data: {
      token,
      expiresAt,
    },
  });
};

export const isRefreshToken = async (token: string): Promise<boolean> => {
  const refreshToken = await prisma.refreshToken.findUnique({
    where: { token },
  });
  return !!refreshToken;
};

export const removeRefreshToken = async (token: string): Promise<boolean> => {
  const result = await prisma.refreshToken.deleteMany({
    where: { token },
  });
  // result.count gives number of records deleted
  return result.count > 0;
};
