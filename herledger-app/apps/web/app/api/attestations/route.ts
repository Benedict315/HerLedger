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

  const events = await prisma.financialEvent.findMany({
    where: { businessId: profile.businessId },
    select: { eventId: true },
  });

  const attestations = await prisma.attestation.findMany({
    where: { eventId: { in: events.map((e) => e.eventId) } },
    orderBy: { ledgerSequence: "desc" },
  });

  return NextResponse.json({ data: { attestations }, error: null });
}
