const makeNow = () => Date.now();

export const getClientIp = (req) => {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
};

const store = (() => {
  if (!globalThis.__BJ3LLA_RATE_LIMIT__) {
    globalThis.__BJ3LLA_RATE_LIMIT__ = new Map();
  }
  return globalThis.__BJ3LLA_RATE_LIMIT__;
})();

export const rateLimit = ({ key, limit, windowMs }) => {
  const now = makeNow();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSec: Math.ceil(windowMs / 1000) };
  }

  if (entry.count >= limit) {
    const retryAfterMs = Math.max(0, entry.resetAt - now);
    return { allowed: false, remaining: 0, retryAfterSec: Math.ceil(retryAfterMs / 1000) };
  }

  entry.count += 1;
  store.set(key, entry);
  return { allowed: true, remaining: limit - entry.count, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
};

export const validateRoomId = (roomID) => {
  if (typeof roomID !== "string") return { ok: false, error: "Invalid roomID" };
  const trimmed = roomID.trim().toUpperCase();
  // Keep room IDs small and predictable to reduce abuse surface.
  // Adjust length if your UI allows longer.
  if (!/^[A-Z0-9]{4,12}$/.test(trimmed)) {
    return { ok: false, error: "Room code must be 4-8 characters (A-Z, 0-9)" };
  }
  return { ok: true, value: trimmed };
};

export const validateUsername = (username) => {
  if (typeof username !== "string") return { ok: false, error: "Invalid username" };
  const trimmed = username.trim();
  if (trimmed.length < 1 || trimmed.length > 24) {
    return { ok: false, error: "Username must be 1-24 characters" };
  }
  // Allow letters, numbers, spaces, underscore, dash.
  if (!/^[\p{L}0-9 _-]+$/u.test(trimmed)) {
    return { ok: false, error: "Username contains invalid characters" };
  }
  return { ok: true, value: trimmed };
};
