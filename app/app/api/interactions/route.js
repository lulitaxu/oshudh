import { NextResponse } from "next/server";
import { rateLimit, peekRateLimit, consumeProviderBudget } from "@/lib/rate-limit";
import { checkInteractions } from "@/lib/providers/gemini";

// POST /api/interactions  { medicines: [{ name, strength }] }
// Returns { interactions: [{ drugs, severity, effect }] }.
// AI-suggested only — the UI labels it as such. Verify with a pharmacist.
export const maxDuration = 60;

// Each call spends paid model quota and the route is public, so limit
// per IP: 10/minute and 40/hour. The hourly cap was raised from 20 when
// the global daily provider circuit-breaker was added (audit 2026-11-11):
// quota protection now comes from the global ceiling, so users sharing
// one CGNAT egress IP starve each other less.
const INTERACTION_LIMITS = [
  { limit: 10, windowMs: 60 * 1000 },
  { limit: 40, windowMs: 60 * 60 * 1000 },
];

// A prescription rarely lists more than a dozen medicines; cap the list
// and each field so one request cannot turn into an unbounded prompt.
const MAX_MEDICINES = 30;
const MAX_NAME_CHARS = 120;
const MAX_STRENGTH_CHARS = 40;

function sanitizeMedicines(medicines) {
  if (!Array.isArray(medicines)) return null;
  if (medicines.length > MAX_MEDICINES) {
    return {
      error: `Too many medicines in one check. Please keep it to ${MAX_MEDICINES} or fewer.`,
    };
  }
  const clean = [];
  for (const m of medicines) {
    if (!m || typeof m.name !== "string" || m.name.trim().length === 0) {
      return { error: "Each medicine needs a name." };
    }
    if (m.name.length > MAX_NAME_CHARS) {
      return {
        error: `Medicine names must be ${MAX_NAME_CHARS} characters or fewer.`,
      };
    }
    if (
      m.strength != null &&
      (typeof m.strength !== "string" || m.strength.length > MAX_STRENGTH_CHARS)
    ) {
      return {
        error: `Medicine strength must be ${MAX_STRENGTH_CHARS} characters or fewer.`,
      };
    }
    clean.push({
      name: m.name.trim(),
      strength: typeof m.strength === "string" ? m.strength.trim() : undefined,
    });
  }
  return { medicines: clean };
}

function tooMany(retryAfter) {
  return NextResponse.json(
    {
      error:
        "Too many checks in a short time. Please wait a little and try again.",
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

export async function POST(req) {
  // Peek first: the key check and request validation below run before
  // any budget is consumed, so 503/400 responses cannot burn the budget
  // that legitimate requests behind the same shared IP need.
  const peek = peekRateLimit(req, "interactions", INTERACTION_LIMITS);
  if (!peek.ok) return tooMany(peek.retryAfter);
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Interaction checks are not available right now." },
        { status: 503 }
      );
    }
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Send a list of medicines to check." },
        { status: 400 }
      );
    }
    const checked = sanitizeMedicines(body?.medicines);
    if (!checked || checked.error) {
      return NextResponse.json(
        { error: checked?.error || "Send a list of medicines to check." },
        { status: 400 }
      );
    }
    if (checked.medicines.length < 2) {
      return NextResponse.json({ interactions: [] });
    }

    // Validation passed — now consume per-IP budget.
    const rl = rateLimit(req, "interactions", INTERACTION_LIMITS);
    if (!rl.ok) return tooMany(rl.retryAfter);

    // Global daily circuit-breaker (see lib/rate-limit.js).
    if (!consumeProviderBudget()) {
      return NextResponse.json(
        {
          error:
            "Oshudh has hit its daily reading limit. Please try again tomorrow.",
        },
        { status: 503 }
      );
    }
    const result = await checkInteractions(checked.medicines);
    return NextResponse.json({ ...result });
  } catch (err) {
    // Provider details stay in the server log; clients get a generic line.
    console.error("interaction check failed:", err);
    return NextResponse.json(
      { error: "Interaction check failed. Please try again in a moment." },
      { status: 500 }
    );
  }
}
