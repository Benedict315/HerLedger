import type { z } from "zod";
import { ApiRequestError, ApiValidationError } from "./errors";
import type { EnvelopeShape } from "./envelope";

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

function toQueryString(params: Record<string, unknown>): string {
  const usp = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    usp.set(key, String(value));
  }
  const qs = usp.toString();
  return qs ? `?${qs}` : "";
}

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
