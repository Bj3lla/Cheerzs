import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { getClientIp, rateLimit, validateRoomId, validateUsername } from "./security";

describe("api/_lib/security", () => {
  beforeEach(() => {
    // Reset in-memory store between tests.
    // The security module keeps a reference to the Map, so we must clear it
    // (replacing globalThis.__BJ3LLA_RATE_LIMIT__ would not affect that reference).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const map = (globalThis as any).__BJ3LLA_RATE_LIMIT__ as Map<string, unknown> | undefined;
    if (map) map.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("getClientIp", () => {
    it("uses x-forwarded-for when present", () => {
      const req = {
        headers: { "x-forwarded-for": "1.2.3.4, 5.6.7.8" },
        socket: { remoteAddress: "9.9.9.9" },
      };
      expect(getClientIp(req)).toBe("1.2.3.4");
    });

    it("falls back to socket.remoteAddress", () => {
      const req = { headers: {}, socket: { remoteAddress: "9.9.9.9" } };
      expect(getClientIp(req)).toBe("9.9.9.9");
    });

    it("returns 'unknown' when no info", () => {
      const req = { headers: {} };
      expect(getClientIp(req)).toBe("unknown");
    });
  });

  describe("validateRoomId", () => {
    it("rejects non-string", () => {
      expect(validateRoomId(null).ok).toBe(false);
      expect(validateRoomId(123).ok).toBe(false);
    });

    it("normalizes to trimmed uppercase", () => {
      const r = validateRoomId(" ab12 ");
      expect(r).toEqual({ ok: true, value: "AB12" });
    });

    it("enforces length and allowed characters", () => {
      expect(validateRoomId("ABC").ok).toBe(false); // too short
      expect(validateRoomId("A".repeat(17)).ok).toBe(false); // too long
      expect(validateRoomId("ABCD!").ok).toBe(false); // invalid char
    });
  });

  describe("validateUsername", () => {
    it("rejects non-string", () => {
      expect(validateUsername(undefined).ok).toBe(false);
      expect(validateUsername({}).ok).toBe(false);
    });

    it("trims and accepts unicode letters", () => {
      const r = validateUsername("  Åse ");
      expect(r).toEqual({ ok: true, value: "Åse" });
    });

    it("enforces length constraints", () => {
      expect(validateUsername("").ok).toBe(false);
      expect(validateUsername("a".repeat(25)).ok).toBe(false);
    });

    it("rejects disallowed characters", () => {
      expect(validateUsername("bad<>name").ok).toBe(false);
      expect(validateUsername("name/with/slash").ok).toBe(false);
    });
  });

  describe("rateLimit", () => {
    it("allows up to limit within window", () => {
      vi.spyOn(Date, "now").mockReturnValue(1000);

      const r1 = rateLimit({ key: "k", limit: 2, windowMs: 1000 });
      const r2 = rateLimit({ key: "k", limit: 2, windowMs: 1000 });

      expect(r1.allowed).toBe(true);
      expect(r2.allowed).toBe(true);
    });

    it("blocks once limit exceeded and resets after window", () => {
      const now = vi.spyOn(Date, "now");

      now.mockReturnValue(1000);
      expect(rateLimit({ key: "k", limit: 1, windowMs: 1000 }).allowed).toBe(true);
      expect(rateLimit({ key: "k", limit: 1, windowMs: 1000 }).allowed).toBe(false);

      // After window passes
      now.mockReturnValue(2500);
      expect(rateLimit({ key: "k", limit: 1, windowMs: 1000 }).allowed).toBe(true);
    });
  });
});
