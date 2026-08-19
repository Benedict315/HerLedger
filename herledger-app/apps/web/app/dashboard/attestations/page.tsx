import type { Metadata } from "next";
import Link from "next/link";

import { AttestationList } from "@/components/attestations/attestation-list";

export const metadata: Metadata = { title: "Attestations" };

export default function AttestationsPage() {
  return (
    <div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          gap: "1rem",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700 }}>Attestations</h1>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <Link
            href={"/dashboard/attestations/create" as any}
            style={{
              padding: "0.5rem 1rem",
              background: "var(--primary)",
              color: "#fff",
              borderRadius: "var(--radius)",
              fontSize: "0.875rem",
              fontWeight: 500,
              textDecoration: "none",
            }}
          >
            Create attestation
          </Link>
          <Link
            href={"/dashboard/attestations/register" as any}
            style={{
              padding: "0.5rem 1rem",
              border: "1px solid var(--border)",
              borderRadius: "var(--radius)",
              fontSize: "0.875rem",
              fontWeight: 500,
              color: "var(--foreground)",
              textDecoration: "none",
            }}
          >
            Register attester
          </Link>
        </div>
      </div>
      <AttestationList />
    </div>
  );
}
