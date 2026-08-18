import { NextRequest } from "next/server";
import { describe, it, expect } from "vitest";

import { middleware } from "../middleware";

function requestFor(path: string, sessionToken?: string): NextRequest {
  const request = new NextRequest(new URL(path, "https://app.herledger.example"));
  if (sessionToken) {
    request.cookies.set("better-auth.session_token", sessionToken);
  }
  return request;
}

describe("middleware", () => {
  it("redirects an unauthenticated request for a protected route to sign-in", () => {
    const response = middleware(requestFor("/dashboard"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/auth/sign-in");
    expect(location.searchParams.get("callbackUrl")).toBe("/dashboard");
  });

  it("allows an authenticated request through to a protected route", () => {
    const response = middleware(requestFor("/dashboard", "valid-session"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects an authenticated request away from the sign-in page", () => {
    const response = middleware(requestFor("/auth/sign-in", "valid-session"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/dashboard");
  });

  it("redirects an authenticated request away from the sign-up page", () => {
    const response = middleware(requestFor("/auth/sign-up", "valid-session"));

    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/dashboard");
  });

  it("allows an unauthenticated request through to the sign-in page", () => {
    const response = middleware(requestFor("/auth/sign-in"));

    expect(response.headers.get("location")).toBeNull();
  });

  it("allows an unauthenticated request through to an unprotected route", () => {
    const response = middleware(requestFor("/"));

    expect(response.headers.get("location")).toBeNull();
  });
});
