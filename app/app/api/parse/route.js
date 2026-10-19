import { NextResponse } from "next/server";
import { SAMPLE_PARSE } from "@/lib/mock";
import { metaParsePrescription } from "@/lib/providers/meta";
import { geminiParsePrescription } from "@/lib/providers/gemini";

// POST /api/parse  { image: "data:image/jpeg;base64,..." }
// Returns the structured parse JSON. Keys stay server-side.
// Vision calls can take a while; allow up to 60s on the function.
export const maxDuration = 60;

// ~4.5MB Vercel payload cap on serverless; base64 inflates ~33%.
// The client downscales photos to 1600px JPEG before upload.
const MAX_IMAGE_CHARS = 6_000_000;

function pickProvider() {
  if (process.env.MODEL_PROVIDER) return process.env.MODEL_PROVIDER;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.META_API_KEY) return "meta";
  return "mock";
}

export async function POST(req) {
  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string" || !image.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "Send an image as a data URL." },
        { status: 400 }
      );
    }
    if (image.length > MAX_IMAGE_CHARS) {
      return NextResponse.json(
        { error: "Image too large. Use a smaller photo." },
        { status: 413 }
      );
    }

    const provider = pickProvider();

    if (provider === "gemini") {
      const parsed = await geminiParsePrescription(image);
      return NextResponse.json({ ...parsed, _provider: "gemini" });
    }

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
