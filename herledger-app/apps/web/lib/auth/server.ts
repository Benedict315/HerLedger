import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import { getServerEnv } from "@herledger/config";

// ---------------------------------------------------------------------------
// Better Auth server instance
// Application auth is separate from Stellar wallet connection.
//
// Prisma 7's client no longer accepts a bare connection string
// (`datasourceUrl`) — it requires an explicit driver adapter. See
// https://pris.ly/d/driver-adapters.
// ---------------------------------------------------------------------------

const env = getServerEnv();

const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

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
  advanced: {
    // Better Auth has no `csrf` option — CSRF protection is the
    // Origin/Referer + Fetch Metadata check in its origin-check middleware,
    // and it is on by default. BUT that middleware auto-disables itself
    // whenever NODE_ENV === "test" (see @better-auth/core's `isTest()`),
    // which is exactly what CI sets for the whole test job. Force it on
    // explicitly so a `test` NODE_ENV can never silently turn off CSRF
    // protection in this app, in CI or otherwise.
    disableOriginCheck: false,
  },
});

export type Auth = typeof auth;
