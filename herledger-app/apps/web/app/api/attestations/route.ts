import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";
import { typedJson } from "@/lib/api/route-handler";
import type { AttestationsResponse } from "./schema";

const prisma = new PrismaClient();

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return typedJson<AttestationsResponse>(
      { data: null, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const profile = await prisma.businessProfile.findFirst({
    where: { userId: session.user.id },
    select: { businessId: true },
  });
  if (!profile) {
    return typedJson<AttestationsResponse>({ data: { attestations: [] }, error: null });
  }

  const events = await prisma.financialEvent.findMany({
    where: { businessId: profile.businessId },
    select: {
      eventId: true,
      attestations: {
        orderBy: { ledgerSequence: "desc" },
      },
    },
  });

  const attestations = events
    .flatMap((event) => event.attestations)
    .sort((a, b) => b.ledgerSequence - a.ledgerSequence);

  return typedJson<AttestationsResponse>({ data: { attestations }, error: null });
}