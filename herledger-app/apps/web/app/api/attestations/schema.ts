import { z } from "zod";
import { createResponseSchema, type SuccessData } from "@/lib/api/envelope";

export const RequestSchema = z.object({});
export type AttestationsRequest = z.input<typeof RequestSchema>;

export const AttestationSchema = z.object({
  id: z.string(),
  attestationId: z.string(),
  eventId: z.string(),
  attesterAddress: z.string(),
  claimHash: z.string(),
  status: z.enum(["Active", "Revoked"]),
  ledgerSequence: z.number(),
});
export type AttestationDto = z.infer<typeof AttestationSchema>;

const AttestationsDataSchema = z.object({
  attestations: z.array(AttestationSchema),
});

export const ResponseSchema = createResponseSchema(AttestationsDataSchema);
export type AttestationsResponse = z.infer<typeof ResponseSchema>;
export type AttestationsData = SuccessData<typeof ResponseSchema>;