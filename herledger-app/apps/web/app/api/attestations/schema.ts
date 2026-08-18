import { z } from "zod";

// ---------------------------------------------------------------------------
// Query params for GET /api/attestations
//
// An attester may revoke a previously-issued attestation; defaulting to
// Active-only keeps the endpoint from misleading callers about the current
// verified state of their events. `includeRevoked=true` is an explicit
// opt-in for callers that need the full history (e.g. an audit view).
// ---------------------------------------------------------------------------
export const attestationsQuerySchema = z.object({
  includeRevoked: z
    .enum(["true", "false"])
    .optional()
    .default("false")
    .transform((val) => val === "true"),
});

export type AttestationsQuery = z.infer<typeof attestationsQuerySchema>;
