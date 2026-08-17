import type { z } from "zod";
import { ApiRequestError, ApiValidationError } from "./errors";

import {
  RequestSchema as ActivityRecentRequestSchema,
  ResponseSchema as ActivityRecentResponseSchema,
  type ActivityRecentRequest,
  type ActivityRecentData,
} from "@/app/api/activity/recent/schema";

import {
  ResponseSchema as AttestationsResponseSchema,
  type AttestationsData,
} from "@/app/api/attestations/schema";

import {
  RequestSchema as BusinessRegisterRequestSchema,
  ResponseSchema as BusinessRegisterResponseSchema,
  type BusinessRegisterRequest,
  type BusinessRegisterData,
} from "@/app/api/business/register/schema";

import {
  ResponseSchema as HealthResponseSchema,
  type HealthData,
} from "@/app/api/health/schema";

// ---------------------------------------------------------------------------
// Core request pipeline. One place that owns URL construction, JSON parsing,
// Zod response validation, and structured-error extraction — no component
// should ever call fetch() directly against /api/*.
// ---------------------------------------------------------------------------

function toQueryString(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

async function request<ResponseSchema extends z.ZodTypeAny>(
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

  // Validate the *shape* of the response against the same schema the server
  // route declares its output as. A mismatch here means the server changed
  // its contract without the client being updated to match — that's exactly
  // the class of bug this client exists to catch, at runtime, before the
  // malformed data reaches a component.
  const parsed = responseSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiValidationError(
      `Response from ${path} did not match the expected schema`,
      parsed.error.issues
    );
  }

  const envelope = parsed.data as { data: unknown; error: { code: string; message: string } | null };
  if (envelope.error) {
    throw new ApiRequestError(envelope.error.code, envelope.error.message, res.status);
  }

  return envelope.data as Extract<z.infer<ResponseSchema>, { error: null }>["data"];
}

// ---------------------------------------------------------------------------
// Public client. One namespaced group per route file, one method per HTTP
// verb. Module-level object rather than a class — see PR description for
// the reasoning; it matches the existing `lib/auth/client.ts` convention.
// ---------------------------------------------------------------------------

export const apiClient = {
  activity: {
    async recent(params: ActivityRecentRequest = {}): Promise<ActivityRecentData> {
      const normalized = ActivityRecentRequestSchema.parse(params);
      const qs = toQueryString(normalized);
      return request(`/api/activity/recent${qs}`, ActivityRecentResponseSchema);
    },
  },

  attestations: {
    async list(): Promise<AttestationsData> {
      return request("/api/attestations", AttestationsResponseSchema);
    },
  },

  business: {
    async register(body: BusinessRegisterRequest): Promise<BusinessRegisterData> {
      const normalized = BusinessRegisterRequestSchema.parse(body);
      return request("/api/business/register", BusinessRegisterResponseSchema, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(normalized),
      });
    },
  },

  health: {
    async check(): Promise<HealthData> {
      return request("/api/health", HealthResponseSchema);
    },
  },
};

export { ApiRequestError, ApiValidationError } from "./errors";