import { z } from "zod";

import { createResponseSchema, type SuccessData } from "@/lib/api/envelope";

export const RequestSchema = z.object({});
export type HealthRequest = z.input<typeof RequestSchema>;

const HealthDataSchema = z.object({ status: z.literal("ok") });

export const ResponseSchema = createResponseSchema(HealthDataSchema);
export type HealthResponse = z.infer<typeof ResponseSchema>;
export type HealthData = SuccessData<typeof ResponseSchema>;
