import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { auth } from "@/lib/auth/server";
import { headers } from "next/headers";

const prisma = new PrismaClient();

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) {
    return NextResponse.json(
      { data: null, error: { code: "UNAUTHORIZED", message: "Not authenticated" } },
      { status: 401 }
    );
  }

  const profile = await prisma.businessProfile.findFirst({
    where: { userId: session.user.id },
    select: { businessId: true },
  });
  if (!profile) {
    return NextResponse.json({ data: { attestations: [] }, error: null });
  }

  // Single round-trip: fetch this business's events together with their
  // attestations via the FinancialEvent -> Attestation relation, instead of
  // a separate findMany per event. Reduces this endpoint to 2 DB calls total
  // (profile lookup + this query) regardless of event count.
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
    .flatMap((event: { attestations: unknown[] }) => event.attestations)
    .sort(
      (a: { ledgerSequence: number }, b: { ledgerSequence: number }) =>
        b.ledgerSequence - a.ledgerSequence
    );

  return NextResponse.json({ data: { attestations }, error: null });
}