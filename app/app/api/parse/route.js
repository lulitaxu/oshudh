import { NextResponse } from "next/server";
import { SAMPLE_PARSE } from "@/lib/mock";
import { metaParsePrescription } from "@/lib/providers/meta";

// POST /api/parse  { image: "data:image/jpeg;base64,..." }
// Returns the structured parse JSON. Keys stay server-side.

export async function POST(req) {
  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Send an image as a data URL." },
        { status: 400 }
      );
    }

    const provider = process.env.MODEL_PROVIDER || "mock";

    if (provider === "meta") {
      const parsed = await metaParsePrescription(image);
      return NextResponse.json(parsed);
    }

    // mock: simulate model latency so the UI states get exercised
    await new Promise((r) => setTimeout(r, 2200));
    return NextResponse.json({ ...SAMPLE_PARSE, _provider: "mock" });
  } catch (err) {
    return NextResponse.json(
      { error: err.message || "Parse failed." },
      { status: 500 }
    );
  }
}
