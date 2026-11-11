// Best-effort per-IP rate limiting for API routes.
// In-memory: per serverless instance. Raises the cost of scripts draining
// the paid vision-model quota on the public endpoints — not a replacement
// for a distributed limiter if traffic ever grows teeth.
//
// Audit 2026-11-11: a distributed limiter (Upstash / Vercel KV) is still
// the proper fix for IP-rotation / serverless fan-out, but it needs new
// infrastructure. Until then this module also carries a per-instance
// GLOBAL daily circuit-breaker on provider calls (see providerBudget
// below): every IP and route on one instance shares one daily ceiling,
// so rotating IPs against a warm instance cannot drain unbounded quota
// through it. Cold-start fan-out still multiplies the ceiling by the
// number of live instances — that residual is exactly what the shared
// store would close.

const buckets = new Map();

function clientIp(req) {
  // Vercel appends the real client IP as the LAST x-forwarded-for value;
  // the leftmost is attacker-controlled, so take the rightmost.
  const fwd = req.headers.get("x-forwarded-for") || "";
  return fwd.split(",").pop().trim() || req.headers.get("x-real-ip") || "unknown";
}

const MAX_BUCKETS = 10000;

// Evict buckets whose window has fully expired; if the Map is still over
// the hard cap afterwards, evict oldest-first. Runs on every limiter call
// (including rejected ones) once the cap is crossed — cleanup is a cap,
// not a success-path trigger.
function cleanupBuckets(now) {
  if (buckets.size <= MAX_BUCKETS) return;
  for (const [k, v] of buckets) {
    if (now - v.start > v.windowMs) buckets.delete(k);
  }
  if (buckets.size > MAX_BUCKETS) {
    const byAge = [...buckets.entries()].sort((a, b) => a[1].start - b[1].start);
    for (const [k] of byAge) {
      if (buckets.size <= MAX_BUCKETS) break;
      buckets.delete(k);
    }
  }
}

function bucketFor(route, ip, windowMs, now) {
  const key = `${route}:${ip}:${windowMs}`;
  let b = buckets.get(key);
  if (!b || now - b.start > windowMs) {
    b = { start: now, count: 0, windowMs };
    buckets.set(key, b);
  }
  return b;
}

function overLimit(req, route, limits, count) {
  const ip = clientIp(req);
  const now = Date.now();
  cleanupBuckets(now);
  for (const { limit, windowMs } of limits) {
    const b = bucketFor(route, ip, windowMs, now);
    if (count) b.count += 1;
    if (b.count > limit) {
      return {
        ok: false,
        retryAfter: Math.max(1, Math.ceil((b.start + windowMs - now) / 1000)),
      };
    }
  }
  return { ok: true };
}

// limits: [{ limit, windowMs }, ...] — every window must pass.
// Returns { ok: true } or { ok: false, retryAfter } (seconds).
// Counts the request against every window.
export function rateLimit(req, route, limits) {
  return overLimit(req, route, limits, true);
}

// Same check without consuming budget. Routes peek first, run their cheap
// validation (JSON shape, declared type, size), and only then call
// rateLimit() — so malformed/rejected requests no longer burn the budget
// that legitimate requests behind the same shared IP need.
export function peekRateLimit(req, route, limits) {
  return overLimit(req, route, limits, false);
}

// ---- Global provider-call circuit-breaker (per instance, per UTC day) ----
// Counts requests admitted to a provider call across ALL IPs and routes
// on this instance. Default ceiling is generous for a small public app
// and far below what an IP-rotating script would need to matter; tune
// with OSHUDH_DAILY_PROVIDER_CAP if real traffic ever approaches it.
const DEFAULT_DAILY_PROVIDER_CAP = 500;
let budgetDay = "";
let budgetCount = 0;

export function consumeProviderBudget() {
  const cap = Number(process.env.OSHUDH_DAILY_PROVIDER_CAP) || DEFAULT_DAILY_PROVIDER_CAP;
  const today = new Date().toISOString().slice(0, 10);
  if (today !== budgetDay) {
    budgetDay = today;
    budgetCount = 0;
  }
  budgetCount += 1;
  return budgetCount <= cap;
}
