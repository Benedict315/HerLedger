import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaClient } from "@prisma/client";
import { getServerEnv } from "@herledger/config/server";

// ---------------------------------------------------------------------------
// Better Auth server instance
// Application auth is separate from Stellar wallet connection.
// ---------------------------------------------------------------------------

const prisma = new PrismaClient();

const env = getServerEnv();

export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.APP_URL,
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: false,
  },
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 60 * 24 * 7, // 7 days
    },
  },
  trustedOrigins: [env.APP_URL],
});

export type Auth = typeof auth;
