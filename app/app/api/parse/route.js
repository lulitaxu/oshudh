import { NextResponse } from "next/server";
import { SAMPLE_PARSE } from "@/lib/mock";
import { rateLimit } from "@/lib/rate-limit";
import { metaParsePrescription } from "@/lib/providers/meta";
import { geminiParsePrescription } from "@/lib/providers/gemini";

// POST /api/parse  { image: "data:image/jpeg;base64,..." }
// Returns the structured parse JSON. Keys stay server-side.
// Vision calls can take a while; allow up to 60s on the function.
export const maxDuration = 60;

// ~4.5MB Vercel payload cap on serverless; base64 inflates ~33%.
// The client downscales photos to 1600px JPEG before upload.
const MAX_IMAGE_CHARS = 6_000_000;

// Only raster photo formats the providers genuinely accept. Anything
// else (SVG, GIF, a bare data:image/ prefix) is rejected at the route,
// before a provider call is spent on it.
const ALLOWED_IMAGE_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/heic",
]);

function pickProvider() {
  if (process.env.MODEL_PROVIDER) return process.env.MODEL_PROVIDER;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.META_API_KEY) return "meta";
  return "mock";
}

// Each call spends paid vision-model quota and the route is public, so
// limit per IP before anything else runs: 5/minute and 10/hour.
const PARSE_LIMITS = [
  { limit: 5, windowMs: 60 * 1000 },
  { limit: 10, windowMs: 60 * 60 * 1000 },
];

export async function POST(req) {
  const rl = rateLimit(req, "parse", PARSE_LIMITS);
  if (!rl.ok) {
    return NextResponse.json(
      {
        error:
          "Too many photos in a short time. Please wait a little and try again.",
      },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }
  try {
    const { image } = await req.json();
    if (!image || typeof image !== "string" || !image.startsWith("data:")) {
      return NextResponse.json(
        { error: "Send an image as a data URL." },
        { status: 400 }
      );
    }
    const imageType = /^data:([^;,]+)/.exec(image)?.[1]?.toLowerCase();
    if (!ALLOWED_IMAGE_TYPES.has(imageType)) {
      return NextResponse.json(
        {
          error:
            "That image type is not supported. Send a JPEG, PNG, WebP or HEIC photo.",
        },
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
      return NextResponse.json({ ...parsed });
    }

    if (provider === "meta") {
      const parsed = await metaParsePrescription(image);
      return NextResponse.json({ ...parsed });
    }

    // mock: simulate model latency so the UI states get exercised
    await new Promise((r) => setTimeout(r, 2200));
    return NextResponse.json({ ...SAMPLE_PARSE, demo: true });
  } catch (err) {
    // Provider details stay in the server log; clients get a generic line.
    console.error("parse failed:", err);
    return NextResponse.json(
      {
        error:
          "Something went wrong reading that photo. Please try again with a clearer photo.",
      },
      { status: 500 }
    );
  }
}
