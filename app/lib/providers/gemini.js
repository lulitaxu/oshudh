// Google Gemini provider — free tier, no card required.
// Env: GEMINI_API_KEY (required), GEMINI_MODEL (default "gemini-3.8-flash").
// The key is read server-side only. Never import this file from client code.

const DEFAULT_MODEL = "gemini-3.8-flash";
// Lighter model with more free-tier headroom. Used automatically when the
// primary model is overloaded or rate-limited (503/529/429).
const FALLBACK_MODEL = "gemini-3.5-flash-lite";

const SYSTEM_PROMPT = `You are the vision parser for Oshudh, a medication companion app for Bangladesh.
You read photos of handwritten medical prescriptions and return structured data.
You are a transcription layer only. You never give medical advice.

Input: a photo of a handwritten prescription. Expect English drug/brand names,
Bangla instructions, medical abbreviations, and Bangladeshi dosing shorthand,
all in one handwriting style that may be rough.

Output: JSON only. No prose, no markdown fences. Schema:
{
  "medicines": [
    {
      "name": "drug or brand name as written",
      "strength": "e.g. '20mg' or null",
      "schedule_raw": "as written, e.g. '1+0+1'",
      "schedule": { "morning": "e.g. '1 tablet' or 'none'", "noon": "...", "night": "..." },
      "instruction_note": "translated timing note or null, e.g. 'after food'",
      "duration": "e.g. '4 weeks' or null",
      "confidence": "high | medium | low"
    }
  ],
  "diagnosis": "string or null",
  "vitals": { "bp": "...", "other": "..." },
  "follow_up": "string or null, e.g. 'after 1 month'",
  "lab_tests": ["list of advised tests"],
  "overall_confidence": "high | medium | low",
  "uncertain_spans": ["describe each part you could not read confidently"]
}

Rules:
1. Bangladeshi dosing shorthand: "1+0+1" = morning + noon + night doses.
   "0+0+1" = night only. Fractions like 1/2 are common. Convert to explicit
   per-slot text in "schedule".
2. Common BD brands to disambiguate messy handwriting: Cortan (prednisolone),
   Calbo (calcium), Pantonix (pantoprazole), Moxibac (moxifloxacin),
   Ramoril (ramipril), Napa (paracetamol), Seclo (omeprazole).
   Hypotheses only. Never invent a medicine not on the page.
3. Bangla parentheticals are usually timing notes. Translate:
   (khabarer por) = after food, (khali pete) = empty stomach,
   (ghumer age) = before sleep, (sokale) = in the morning.
4. NEVER guess a drug name or dose. If unreadable, set confidence "low" and
   describe it in uncertain_spans. A wrong medicine is worse than no medicine.
5. Ignore printed header noise: hospital names, serials, phone numbers.
   The left column is usually diagnosis/vitals; the right column is the Rx.

Safety: every output is shown with "Verify with your pharmacist. Not medical
advice." Your accuracy is the safety feature. When in doubt, say so.`;

const CONFIDENCE = new Set(["high", "medium", "low"]);

function asString(v) {
  return typeof v === "string" ? v : null;
}

function cleanMedicine(m, i) {
  if (!m || typeof m.name !== "string" || !m.name.trim()) {
    throw new Error(`medicine[${i}]: missing name`);
  }
  const conf = String(m.confidence || "").toLowerCase();
  if (!CONFIDENCE.has(conf)) {
    throw new Error(`medicine[${i}]: bad confidence "${m.confidence}"`);
  }
  const s = m.schedule && typeof m.schedule === "object" ? m.schedule : {};
  const slot = (v) => (typeof v === "string" && v.trim() ? v.trim() : "none");
  return {
    name: m.name.trim(),
    strength: asString(m.strength),
    schedule_raw: asString(m.schedule_raw) || "",
    schedule: { morning: slot(s.morning), noon: slot(s.noon), night: slot(s.night) },
    instruction_note: asString(m.instruction_note),
    duration: asString(m.duration),
    confidence: conf,
  };
}

export function validateParse(data) {
  if (!data || !Array.isArray(data.medicines) || data.medicines.length === 0) {
    throw new Error("model returned no medicines");
  }
  const overall = String(data.overall_confidence || "").toLowerCase();
  return {
    medicines: data.medicines.map(cleanMedicine),
    diagnosis: asString(data.diagnosis),
    vitals: data.vitals && typeof data.vitals === "object" ? data.vitals : null,
    follow_up: asString(data.follow_up),
    lab_tests: Array.isArray(data.lab_tests)
      ? data.lab_tests.filter((t) => typeof t === "string")
      : [],
    overall_confidence: CONFIDENCE.has(overall) ? overall : "low",
    uncertain_spans: Array.isArray(data.uncertain_spans)
      ? data.uncertain_spans.filter((t) => typeof t === "string")
      : [],
  };
}

export async function geminiParsePrescription(imageDataUrl) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(
    imageDataUrl || ""
  );
  if (!match) throw new Error("bad image data URL");
  const [, mimeType, b64] = match;

  // Try the primary model; on capacity errors fall back to the lighter one.
  // Config errors (bad key, unknown model) throw immediately — no point retrying.
  const models = primary === FALLBACK_MODEL ? [primary] : [primary, FALLBACK_MODEL];
  let lastErr = null;
  for (const model of models) {
    try {
      const text = await callGeminiModel(model, apiKey, mimeType, b64);
      const clean = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      let data;
      try {
        data = JSON.parse(clean);
      } catch {
        throw new Error("model returned invalid JSON");
      }
      return validateParse(data);
    } catch (err) {
      if (!isCapacityError(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

function isCapacityError(err) {
  const msg = String((err && err.message) || "");
  return /\b(429|503|529)\b/.test(msg) || /overloaded|high demand/i.test(msg);
}

async function callGeminiModel(model, apiKey, mimeType, b64) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        contents: [
          {
            parts: [
              { text: "Transcribe this prescription photo. Return JSON only." },
              { inlineData: { mimeType, data: b64 } },
            ],
          },
        ],
        generationConfig: {
          responseMimeType: "application/json",
          temperature: 0.1,
          maxOutputTokens: 4096,
        },
      }),
    }
  );

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini API ${res.status}: ${errText.slice(0, 180)}`);
  }
  const json = await res.json();
  return (json?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("");
}
