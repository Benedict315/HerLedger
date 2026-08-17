import type { z } from "zod";
import { ApiRequestError, ApiValidationError } from "./errors";
import type { EnvelopeShape } from "./envelope";

// ... toQueryString unchanged ...

async function request<ResponseSchema extends z.ZodType<EnvelopeShape>>(
  path: string,
  responseSchema: ResponseSchema,
  init?: RequestInit
): Promise<Extract<z.infer<ResponseSchema>, { error: null }>["data"]> {
  const res = await fetch(path, init);

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    throw new ApiRequestError(
      "INVALID_JSON",
      "Server returned a response that was not valid JSON",
      res.status
    );
  }

  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiValidationError(
      `Response from ${path} did not match the expected schema`,
      parsed.error.issues
    );
  }

  const envelope = parsed.data;
  if (envelope.error) {
    throw new ApiRequestError(envelope.error.code, envelope.error.message, res.status);
  }

  return envelope.data as Extract<z.infer<ResponseSchema>, { error: null }>["data"];
}