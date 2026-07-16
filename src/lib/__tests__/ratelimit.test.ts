import { describe, expect, it } from "vitest";
import { rateLimit } from "@/lib/ratelimit";

describe("rateLimit", () => {
  it("allows up to the limit", () => {
    const key = "allow-up-to-limit";
    const now = 1_000;
    expect(rateLimit(key, 3, 1000, now)).toBe(true);
    expect(rateLimit(key, 3, 1000, now)).toBe(true);
    expect(rateLimit(key, 3, 1000, now)).toBe(true);
  });

  it("blocks over the limit within the window", () => {
    const key = "block-over-limit";
    const now = 1_000;
    expect(rateLimit(key, 2, 1000, now)).toBe(true);
    expect(rateLimit(key, 2, 1000, now)).toBe(true);
    expect(rateLimit(key, 2, 1000, now)).toBe(false);
    expect(rateLimit(key, 2, 1000, now + 10)).toBe(false);
  });

  it("resets after the window elapses", () => {
    const key = "reset-after-window";
    const now = 1_000;
    expect(rateLimit(key, 1, 1000, now)).toBe(true);
    expect(rateLimit(key, 1, 1000, now + 500)).toBe(false);
    expect(rateLimit(key, 1, 1000, now + 1000)).toBe(true);
  });
});
