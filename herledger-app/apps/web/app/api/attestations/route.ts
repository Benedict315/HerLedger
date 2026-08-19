import { headers } from "next/headers";
import { NextRequest } from "next/server";

import { typedJson } from "@/lib/api/route-handler";
import { auth } from "@/lib/auth/server";
import { getDbClient } from "@herledger/db";

import { RequestSchema, type AttestationsResponse } from "./schema";

export async function GET(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return typedJson<AttestationsResponse>(
      { data: null, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(req.url);
  const parsed = RequestSchema.safeParse({
    includeRevoked: searchParams.get("includeRevoked") ?? undefined,
  });
  if (!parsed.success) {
    return typedJson<AttestationsResponse>(
      { data: null, error: { code: "INVALID_PARAMS", message: "Invalid query params" } },
      { status: 400 }
    );
  }

  const db = getDbClient();
  const profile = await db.businesses.findByUserId(session.user.id);
  if (!profile) {
    return typedJson<AttestationsResponse>({ data: { attestations: [] }, error: null });
  }

  const attestations = await db.attestations.findByBusiness(profile.businessId, {
    includeRevoked: parsed.data.includeRevoked,
  });

  return typedJson<AttestationsResponse>({ data: { attestations }, error: null });
}
