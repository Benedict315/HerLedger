import { describe, it, expect, vi, beforeEach } from "vitest";
import { retryWithBackoff, type RetryConfig } from "./retry.js";
import { IndexerError } from "../types/index.js";

describe("retryWithBackoff", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns immediately on success", async () => {
    const fn = vi.fn(async () => "success");
    const result = await retryWithBackoff(fn, "test-op");
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on transient errors and eventually succeeds", async () => {
    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt++;
      if (attempt < 3) {
        throw new Error("Network timeout (transient)");
      }
      return "success";
    });

    const result = await retryWithBackoff(fn, "test-op");
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("throws IndexerError after max attempts exceeded", async () => {
    const fn = vi.fn(async () => {
      throw new Error("Network error");
    });

    const config: RetryConfig = { maxAttempts: 2 };
    await expect(retryWithBackoff(fn, "test-op", config)).rejects.toThrow(IndexerError);
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("fails immediately on permanent errors (400s)", async () => {
    const fn = vi.fn(async () => {
      throw new Error("400 Bad Request");
    });

    await expect(retryWithBackoff(fn, "test-op")).rejects.toThrow(IndexerError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("fails immediately on permanent errors (401s)", async () => {
    const fn = vi.fn(async () => {
      throw new Error("401 Unauthorized");
    });

    await expect(retryWithBackoff(fn, "test-op")).rejects.toThrow(IndexerError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("fails immediately on XDR decode errors", async () => {
    const fn = vi.fn(async () => {
      throw new Error("XDR decode failed");
    });

    await expect(retryWithBackoff(fn, "test-op")).rejects.toThrow(IndexerError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("fails immediately on malformed contract errors", async () => {
    const fn = vi.fn(async () => {
      throw new Error("Invalid contract");
    });

    await expect(retryWithBackoff(fn, "test-op")).rejects.toThrow(IndexerError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("retries on 500 server errors", async () => {
    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt++;
      if (attempt < 2) {
        throw new Error("500 Internal Server Error");
      }
      return "success";
    });

    const result = await retryWithBackoff(fn, "test-op", { maxAttempts: 3 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 503 service unavailable", async () => {
    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt++;
      if (attempt < 2) {
        throw new Error("503 Service Unavailable");
      }
      return "success";
    });

    const result = await retryWithBackoff(fn, "test-op", { maxAttempts: 3 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on 429 rate limit errors", async () => {
    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt++;
      if (attempt < 2) {
        throw new Error("429 Too Many Requests");
      }
      return "success";
    });

    const result = await retryWithBackoff(fn, "test-op", { maxAttempts: 3 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on connection refused", async () => {
    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt++;
      if (attempt < 2) {
        throw new Error("ECONNREFUSED");
      }
      return "success";
    });

    const result = await retryWithBackoff(fn, "test-op", { maxAttempts: 3 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("retries on timeout errors", async () => {
    let attempt = 0;
    const fn = vi.fn(async () => {
      attempt++;
      if (attempt < 2) {
        throw new Error("Request timeout");
      }
      return "success";
    });

    const result = await retryWithBackoff(fn, "test-op", { maxAttempts: 3 });
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("uses custom config values", async () => {
    const fn = vi.fn(async () => "success");
    const config: RetryConfig = {
      maxAttempts: 5,
      baseDelayMs: 100,
      maxDelayMs: 1000,
    };

    const result = await retryWithBackoff(fn, "test-op", config);
    expect(result).toBe("success");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("defaults to 3 attempts if maxAttempts not specified", async () => {
    const fn = vi.fn(async () => {
      throw new Error("Network error");
    });

    await expect(retryWithBackoff(fn, "test-op")).rejects.toThrow(IndexerError);
    // Default maxAttempts is 3
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("preserves original error in IndexerError cause", async () => {
    const originalError = new Error("Original network error");
    const fn = vi.fn(async () => {
      throw originalError;
    });

    const config: RetryConfig = { maxAttempts: 1 };
    try {
      await retryWithBackoff(fn, "test-op", config);
      expect.fail("Should have thrown");
    } catch (err) {
      expect(err).toBeInstanceOf(IndexerError);
      const indexerErr = err as IndexerError;
      expect(indexerErr.cause).toBe(originalError);
    }
  });
});
