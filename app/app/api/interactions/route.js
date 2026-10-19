import { NextResponse } from "next/server";
import { checkInteractions } from "@/lib/providers/gemini";

// POST /api/interactions  { medicines: [{ name, strength }] }
// Returns { interactions: [{ drugs, severity, effect }] }.
// AI-suggested only — the UI labels it as such. Verify with a pharmacist.
export const maxDuration = 60;

export async function POST(req) {
  try {
    if (!process.env.GEMINI_API_KEY) {
      return NextResponse.json(
        { error: "Interaction checks need GEMINI_API_KEY." },
        { status: 400 }
      );
    }
    const { medicines } = await req.json();
    if (!Array.isArray(medicines) || medicines.length < 2) {
      return NextResponse.json({ interactions: [] });
    }
    const result = await checkInteractions(medicines);
    return NextResponse.json({ ...result, _provider: "gemini" });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Interaction check failed." },
      { status: 500 }
    );
  }
}
