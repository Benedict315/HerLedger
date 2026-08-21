import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { auth } from "@/lib/auth/server";

import { GET } from "./route";

vi.mock("server-only", () => ({}));
vi.mock("next/headers", () => ({
  headers: vi.fn().mockResolvedValue(new Headers()),
}));
vi.mock("@/lib/auth/server", () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}));

const disputeFindFirstMock = vi.fn();
const businessFindFirstMock = vi.fn();
vi.mock("@/lib/db/client", () => ({
  getPrismaClient: () => ({
    dispute: { findFirst: disputeFindFirstMock },
    businessProfile: { findFirst: businessFindFirstMock },
  }),
}));

function req() {
  return new NextRequest("http://localhost/api/disputes/ev_1/status");
}

describe("GET /api/disputes/[eventId]/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 when not authenticated", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce(null);

    const res = await GET(req(), { params: { eventId: "ev_1" } });
    expect(res.status).toBe(401);
  });

  it("returns 400 when eventId param is empty", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: "u_1" } } as never);

    const res = await GET(req(), { params: { eventId: "" } });
    expect(res.status).toBe(400);
  });

  it("returns 404 when no dispute exists for the event", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: "u_1" } } as never);
    disputeFindFirstMock.mockResolvedValueOnce(null);

    const res = await GET(req(), { params: { eventId: "ev_1" } });
    expect(res.status).toBe(404);
  });

  it("returns 403 when the caller does not own the business", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: "u_1" } } as never);
    disputeFindFirstMock.mockResolvedValueOnce({
      eventId: "ev_1",
      status: "Pending",
      updatedAt: new Date(),
      financialEvent: { businessId: "biz_1" },
    });
    businessFindFirstMock.mockResolvedValueOnce(null);

    const res = await GET(req(), { params: { eventId: "ev_1" } });
    expect(res.status).toBe(403);
  });

  it("returns the dispute status on success", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: "u_1" } } as never);
    disputeFindFirstMock.mockResolvedValueOnce({
      eventId: "ev_1",
      status: "Resolved",
      updatedAt: new Date("2026-01-01"),
      financialEvent: { businessId: "biz_1" },
    });
    businessFindFirstMock.mockResolvedValueOnce({ businessId: "biz_1" });

    const res = await GET(req(), { params: { eventId: "ev_1" } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data.status).toBe("Resolved");
  });

  it("returns 500 when the database call throws", async () => {
    vi.mocked(auth.api.getSession).mockResolvedValueOnce({ user: { id: "u_1" } } as never);
    disputeFindFirstMock.mockRejectedValueOnce(new Error("db down"));

    const res = await GET(req(), { params: { eventId: "ev_1" } });
    expect(res.status).toBe(500);
  });
});
