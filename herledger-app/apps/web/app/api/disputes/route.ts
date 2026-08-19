import { getServerEnv } from "@herledger/config/server";
import { headers } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { auth } from "@/lib/auth/server";
import { encryptDisputeReason } from "@/lib/crypto/dispute-encryption";
import { getDbClient } from "@herledger/db";

const bodySchema = z.object({
  eventId: z.string().min(1).max(64),
  reason: z.string().min(1).max(2000),
  reasonHash: z
    .string()
    .length(64)
    .regex(/^[0-9a-f]{64}$/i, "reasonHash must be a 64-character hex string"),
});

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { data: null, error: { code: "INVALID_BODY", message: "Invalid request body" } },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { data: null, error: { code: "VALIDATION_ERROR", message: "Invalid dispute data" } },
      { status: 400 }
    );
  }

  const { eventId, reason, reasonHash } = parsed.data;

  try {
    const db = getDbClient();
    const profile = await db.businesses.findByUserId(session.user.id);
    if (!profile) {
      return NextResponse.json(
        {
          data: null,
          error: { code: "NO_BUSINESS", message: "No business registered for this account" },
        },
        { status: 403 }
      );
    }

    const event = await db.financialEvents.findById(eventId);
    if (!event) {
      return NextResponse.json(
        { data: null, error: { code: "NOT_FOUND", message: "Financial event not found" } },
        { status: 404 }
      );
    }
    if (event.businessId !== profile.businessId) {
      return NextResponse.json(
        {
          data: null,
          error: { code: "FORBIDDEN", message: "You do not own this financial event" },
        },
        { status: 403 }
      );
    }

    const { BETTER_AUTH_SECRET } = getServerEnv();
    const reasonPlaintext = encryptDisputeReason(reason, BETTER_AUTH_SECRET);

    const dispute = await db.disputes.create({
      eventId,
      userId: session.user.id,
      reasonPlaintext,
      reasonHash,
      status: "Submitted",
    });

    return NextResponse.json({ data: { id: dispute.id }, error: null });
  } catch (err) {
    console.error({ operation: "create-dispute", userId: session.user.id, error: err });
    return NextResponse.json(
      { data: null, error: { code: "INTERNAL_ERROR", message: "Failed to record dispute" } },
      { status: 500 }
    );
  }
}
