import { z } from "zod";

// ---------------------------------------------------------------------------
// Every HerLedger API route returns { data, error } where exactly one of the
// two is non-null. This is the single source of truth for that envelope
// shape — every route's schema.ts wraps its data schema with this.
// ---------------------------------------------------------------------------

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ApiErrorShape = z.infer<typeof ApiErrorSchema>;

export function createResponseSchema<DataSchema extends z.ZodTypeAny>(
  dataSchema: DataSchema
) {
  return z.union([
    z.object({ data: dataSchema, error: z.null() }),
    z.object({ data: z.null(), error: ApiErrorSchema }),
  ]);
}

/** Extracts the success-branch `data` type from a route's ResponseSchema. */
export type SuccessData<ResponseSchema extends z.ZodTypeAny> = Extract
  z.infer<ResponseSchema>,
  { error: null }
>["data"];