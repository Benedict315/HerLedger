import { z } from "zod";

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ApiErrorShape = z.infer<typeof ApiErrorSchema>;

/**
 * Structural shape every route's ResponseSchema must conform to.
 *
 * This is what lets TypeScript prove, for an arbitrary caller-supplied
 * ResponseSchema, that `Extract<z.infer<ResponseSchema>, { error: null }>`
 * actually has a `data` property. Constraining by plain `z.ZodTypeAny`
 * (the most general Zod type) gives TS no such guarantee — it can't know
 * every possible schema looks like an envelope — which is why the
 * indexed-access types below only type-check once bounded by this instead.
 */
export type EnvelopeShape = { data: unknown; error: ApiErrorShape | null };

export function createResponseSchema<DataSchema extends z.ZodTypeAny>(
  dataSchema: DataSchema
) {
  return z.union([
    z.object({ data: dataSchema, error: z.null() }),
    z.object({ data: z.null(), error: ApiErrorSchema }),
  ]);
}

/** Extracts the success-branch `data` type from a route's ResponseSchema. */
export type SuccessData<ResponseSchema extends z.ZodType<EnvelopeShape>> = Extract
  z.infer<ResponseSchema>,
  { error: null }
>["data"];