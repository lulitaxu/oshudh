import { NextResponse } from "next/server";
import { SAMPLE_PARSE } from "@/lib/mock";
import { rateLimit, peekRateLimit, consumeProviderBudget } from "@/lib/rate-limit";
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

// The declared type is only a label: verify the payload's magic bytes
// actually match it before spending a provider call. Decodes just the
// head of the base64 payload (enough for every signature incl. the
// WebP/HEIC container brands).
function imageBytesMatchType(image, imageType) {
  const b64 = image.slice(image.indexOf(",") + 1, image.indexOf(",") + 97);
  let head;
  try {
    head = Buffer.from(b64, "base64");
  } catch {
    return false;
  }
  if (head.length < 12) return false;
  switch (imageType) {
    case "image/jpeg":
      return head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff;
    case "image/png":
      return (
        head[0] === 0x89 && head[1] === 0x50 && head[2] === 0x4e && head[3] === 0x47
      );
    case "image/webp":
      return (
        head.toString("ascii", 0, 4) === "RIFF" &&
        head.toString("ascii", 8, 12) === "WEBP"
      );
    case "image/heic": {
      if (head.toString("ascii", 4, 8) !== "ftyp") return false;
      const brand = head.toString("ascii", 8, 12).toLowerCase();
      return ["heic", "heix", "hevc", "mif1", "msf1", "heim", "avif"].includes(brand);
    }
    default:
      return false;
  }
}

function pickProvider() {
  if (process.env.MODEL_PROVIDER) return process.env.MODEL_PROVIDER;
  if (process.env.GEMINI_API_KEY) return "gemini";
  if (process.env.META_API_KEY) return "meta";
  return "mock";
}

// Each call spends paid vision-model quota and the route is public, so
// limit per IP: 5/minute and 20/hour. The hourly cap was raised from 10
// when the global daily provider circuit-breaker was added (audit
// 2026-11-11): quota protection now comes from the global ceiling, so
// users sharing one CGNAT egress IP starve each other less.
const PARSE_LIMITS = [
  { limit: 5, windowMs: 60 * 1000 },
  { limit: 20, windowMs: 60 * 60 * 1000 },
];

function tooMany(retryAfter) {
  return NextResponse.json(
    {
      error:
        "Too many photos in a short time. Please wait a little and try again.",
    },
    { status: 429, headers: { "Retry-After": String(retryAfter) } }
  );
}

export async function POST(req) {
  // Peek first: cheap validation below runs before any budget is
  // consumed, so malformed requests cannot burn a shared IP's budget.
  const peek = peekRateLimit(req, "parse", PARSE_LIMITS);
  if (!peek.ok) return tooMany(peek.retryAfter);
  try {
    let body;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: "Send an image as a data URL." },
        { status: 400 }
      );
    }
    const { image } = body || {};
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
    if (!imageBytesMatchType(image, imageType)) {
      return NextResponse.json(
        {
          error:
            "That file does not look like the photo type it claims to be. Send a JPEG, PNG, WebP or HEIC photo.",
        },
        { status: 400 }
      );
    }

    // Validation passed — now consume per-IP budget.
    const rl = rateLimit(req, "parse", PARSE_LIMITS);
    if (!rl.ok) return tooMany(rl.retryAfter);

    const provider = pickProvider();

    if (provider === "gemini" || provider === "meta") {
      // Global daily circuit-breaker: bounds total provider spend per
      // instance across all IPs (see lib/rate-limit.js).
      if (!consumeProviderBudget()) {
        return NextResponse.json(
          {
            error:
              "Oshudh has hit its daily reading limit. Please try again tomorrow.",
          },
          { status: 503 }
        );
      }
      const parsed =
        provider === "gemini"
          ? await geminiParsePrescription(image)
          : await metaParsePrescription(image);
      return NextResponse.json({ ...parsed });
    }

    // Mock/demo data must never answer a real upload in production: an
    // unconfigured or misspelled MODEL_PROVIDER fails closed with 503,
    // matching /api/interactions. Demo stays available in development,
    // or explicitly with ALLOW_MOCK=1.
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK !== "1") {
      console.error("parse: no usable provider configured in production");
      return NextResponse.json(
        { error: "Prescription reading is not available right now." },
        { status: 503 }
      );
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
