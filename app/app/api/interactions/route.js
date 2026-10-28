import { NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";
import { checkInteractions } from "@/lib/providers/gemini";

// POST /api/interactions  { medicines: [{ name, strength }] }
// Returns { interactions: [{ drugs, severity, effect }] }.
// AI-suggested only — the UI labels it as such. Verify with a pharmacist.
export const maxDuration = 60;

// Each call spends paid model quota and the route is public, so limit
// per IP before anything else runs: 10/minute and 20/hour.
const INTERACTION_LIMITS = [
  { limit: 10, windowMs: 60 * 1000 },
  { limit: 20, windowMs: 60 * 60 * 1000 },
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

export async function POST(req) {
  const rl = rateLimit(req, "interactions", INTERACTION_LIMITS);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error:
          "Too many checks in a short time. Please wait a little and try again.",
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Interaction checks are not available right now." },
        { status: 503 }
      );
    }
    const { medicines } = await req.json();
    const checked = sanitizeMedicines(medicines);
    if (!checked || checked.error) {
      return NextResponse.json(
        { error: checked?.error || "Send a list of medicines to check." },
        { status: 400 }
      );
    }
    if (checked.medicines.length < 2) {
      return NextResponse.json({ interactions: [] });
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
