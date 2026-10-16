import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { validateMagicBytes } from "../lib/image";
import {
  checkPresignRateLimit,
  resetPresignRateLimit,
} from "../lib/rate-limit";

/**
 * Unit tests for two pure security-critical functions:
 *   - validateMagicBytes  (lib/image.ts)   — file-type sniffing.
 *   - checkPresignRateLimit (lib/rate-limit.ts) — per-user throttling.
 *
 * These are pure functions with no database access, so this file needs no
 * DATABASE_URL. It runs alongside the integration tests via `npm run db:test`
 * (vitest include glob `db/**\/*.test.ts`).
 */

/* -------------------------------------------------------------------------- */
/* validateMagicBytes                                                          */
/* -------------------------------------------------------------------------- */

describe("validateMagicBytes", () => {
  it("accepts JPEG bytes declared as image/jpeg", () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]);
    expect(validateMagicBytes("image/jpeg", bytes)).toBe(true);
  });

  it("accepts PNG bytes declared as image/png", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(validateMagicBytes("image/png", bytes)).toBe(true);
  });

  it("accepts PDF bytes declared as application/pdf", () => {
    const bytes = new Uint8Array([0x25, 0x50, 0x44, 0x46]);
    expect(validateMagicBytes("application/pdf", bytes)).toBe(true);
  });

  it("rejects PNG bytes declared as image/jpeg (mismatch)", () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    expect(validateMagicBytes("image/jpeg", bytes)).toBe(false);
  });

  it("rejects garbage bytes for any mime type", () => {
    const bytes = new Uint8Array([0x00, 0x01, 0x02, 0x03]);
    expect(validateMagicBytes("image/jpeg", bytes)).toBe(false);
    expect(validateMagicBytes("image/png", bytes)).toBe(false);
    expect(validateMagicBytes("application/pdf", bytes)).toBe(false);
  });

  it("rejects an empty array", () => {
    const bytes = new Uint8Array([]);
    expect(validateMagicBytes("image/jpeg", bytes)).toBe(false);
    expect(validateMagicBytes("image/png", bytes)).toBe(false);
    expect(validateMagicBytes("application/pdf", bytes)).toBe(false);
  });

  it("rejects arrays shorter than the signature (fewer than 4 bytes)", () => {
    // 3 bytes: shorter than the PNG/PDF signatures (4 bytes each).
    expect(
      validateMagicBytes("image/png", new Uint8Array([0x89, 0x50, 0x4e])),
    ).toBe(false);
    expect(
      validateMagicBytes("application/pdf", new Uint8Array([0x25, 0x50, 0x44])),
    ).toBe(false);
    // 2 bytes: even below the 3-byte JPEG signature.
    expect(
      validateMagicBytes("image/jpeg", new Uint8Array([0xff, 0xd8])),
    ).toBe(false);
  });

  it("accepts a real prefix followed by trailing content", () => {
    // The function only inspects the leading bytes; extra payload is ignored.
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a]);
    expect(validateMagicBytes("image/jpeg", jpeg)).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* checkPresignRateLimit                                                       */
/* -------------------------------------------------------------------------- */

describe("checkPresignRateLimit", () => {
  // The implementation keeps state in a module-level Map. It already exposes
  // `resetPresignRateLimit()` (no arg clears everything), so we reuse it rather
  // than adding a new helper — the least-change option.
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    resetPresignRateLimit();
  });

  afterEach(() => {
    vi.useRealTimers();
    resetPresignRateLimit();
  });

  it("allows the first call for a new user", () => {
    expect(checkPresignRateLimit("user-1")).toBe(true);
  });

  it("allows 10 calls within one hour", () => {
    const results = Array.from({ length: 10 }, () =>
      checkPresignRateLimit("user-2"),
    );
    expect(results).toEqual(Array(10).fill(true));
  });

  it("rejects the 11th call within one hour", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkPresignRateLimit("user-3")).toBe(true);
    }
    // 11th call inside the same hour -> throttled.
    expect(checkPresignRateLimit("user-3")).toBe(false);
  });

  it("allows calls again once the hour window has passed", () => {
    for (let i = 0; i < 10; i++) {
      expect(checkPresignRateLimit("user-4")).toBe(true);
    }
    expect(checkPresignRateLimit("user-4")).toBe(false);

    // Advance just past one hour; the earlier timestamps fall out of the
    // rolling hour window.
    vi.advanceTimersByTime(60 * 60 * 1000 + 1000);
    expect(checkPresignRateLimit("user-4")).toBe(true);
  });

  it("rejects the 51st call within the same day", () => {
    // Spread 50 calls across hours so the per-hour limit (10) is never hit:
    // 5 batches of 10 calls, one batch per hour.
    for (let hour = 0; hour < 5; hour++) {
      if (hour > 0) vi.advanceTimersByTime(60 * 60 * 1000 + 1000);
      for (let i = 0; i < 10; i++) {
        expect(checkPresignRateLimit("user-5")).toBe(true);
      }
    }

    // 51st call, still within the same 24h window -> throttled by the daily cap.
    expect(checkPresignRateLimit("user-5")).toBe(false);
  });

  it("tracks separate users independently", () => {
    // Exhaust user-6's hourly allowance.
    for (let i = 0; i < 10; i++) {
      expect(checkPresignRateLimit("user-6")).toBe(true);
    }
    expect(checkPresignRateLimit("user-6")).toBe(false);

    // A different user is unaffected.
    expect(checkPresignRateLimit("user-7")).toBe(true);
  });
});
