// Best-effort per-IP rate limiting for API routes.
// In-memory: per serverless instance. Raises the cost of scripts draining
// the paid vision-model quota on the public endpoints — not a replacement
// for a distributed limiter if traffic ever grows teeth.

const buckets = new Map();

function clientIp(req) {
  // Vercel appends the real client IP as the LAST x-forwarded-for value;
  // the leftmost is attacker-controlled, so take the rightmost.
  const fwd = req.headers.get("x-forwarded-for") || "";
  return fwd.split(",").pop().trim() || req.headers.get("x-real-ip") || "unknown";
}

// limits: [{ limit, windowMs }, ...] — every window must pass.
// Returns { ok: true } or { ok: false, retryAfter } (seconds).
export function rateLimit(req, route, limits) {
  const ip = clientIp(req);
  const now = Date.now();
  for (const { limit, windowMs } of limits) {
    const key = `${route}:${ip}:${windowMs}`;
    let b = buckets.get(key);
    if (!b || now - b.start > windowMs) b = { start: now, count: 0 };
    b.count += 1;
    buckets.set(key, b);
    if (b.count > limit) {
      return {
        ok: false,
        retryAfter: Math.max(1, Math.ceil((b.start + windowMs - now) / 1000)),
      };
    }
  }
  if (buckets.size > 10000) {
    for (const [k, v] of buckets) {
      if (now - v.start > 60 * 60 * 1000) buckets.delete(k);
    }
  }
  return { ok: true };
}
