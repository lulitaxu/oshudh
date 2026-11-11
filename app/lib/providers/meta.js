// Meta Model API provider — day-1 wiring (draft, 2026-10-21).
// Endpoint/auth/model from public Meta Model API docs (OpenAI-compatible):
//   base  https://api.meta.ai/v1          (env META_API_BASE overrides)
//   POST  {base}/chat/completions
//   auth  Authorization: Bearer <META_API_KEY>   (keys start with LLM_)
//   model muse-spark-1.1                  (env META_MODEL_ID overrides;
//                                          multimodal: text+image in, text out)
// Env: META_API_KEY (required), META_MODEL_ID, META_API_BASE — server side only.
// Switch the app to this provider with MODEL_PROVIDER=meta in Vercel env.
//
// REGION NOTE: public docs say the Model API was US-only in preview and
// reporters outside the supported list see "Model API is not available in
// your region". Bangladesh is NOT on the published hard-block list
// (Pakistan, Ethiopia, Venezuela, Iraq, Cambodia were named), so this is
// untested, not dead. The call runs server-side from Vercel, so test day 1
// from the deployed app first; local testing from a BD IP may fail while the
// deployed app works, or vice versa. Gemini stays the safe default until a
// live Meta parse succeeds.
//
// Key arrives with the $150 hackathon credits — Arz pastes it into Vercel env
// himself, never into chat or the repo.

import { validateParse } from "./gemini";

const DEFAULT_MODEL = "muse-spark-1.1";
const DEFAULT_BASE = "https://api.meta.ai/v1";

// Same system prompt as the Gemini provider — transcription layer only.
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
1. Bangladeshi dosing shorthand is POSITIONAL: three slots in fixed order,
   morning + noon + night. "1+0+1" = morning and night. "0+0+1" = night
   only. "1+1+1" = all three. A 0 or a blank in a slot means NO dose there.
   Sloppy handwriting means the same thing: "1 + 0 + 1", "1++1",
   "1 + + 1" (blank middle = noon gets "none"). NEVER shift a dose into a
   different slot: position 1 is always morning, position 2 always noon,
   position 3 always night. If a slot is genuinely ambiguous, set
   confidence "low" and describe it in uncertain_spans.
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

export async function metaParsePrescription(imageDataUrl) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(
    imageDataUrl || ""
  );
  if (!match) throw new Error("bad image data URL");
  const [, mimeType, b64] = match;
  void mimeType; // carried inside the data URL sent to the model

  const apiKey = process.env.META_API_KEY;
  if (!apiKey) throw new Error("META_API_KEY not set");
  const model = process.env.META_MODEL_ID || DEFAULT_MODEL;
  const base = (process.env.META_API_BASE || DEFAULT_BASE).replace(/\/+$/, "");
  // The API key is sent to this base as a Bearer credential, so refuse
  // anything that is not https on the expected Meta host — a poisoned or
  // mistyped env value must not become a key-delivery address.
  let baseUrl;
  try {
    baseUrl = new URL(base);
  } catch {
    throw new Error("META_API_BASE is not a valid URL");
  }
  if (baseUrl.protocol !== "https:" || baseUrl.hostname !== "api.meta.ai") {
    throw new Error("META_API_BASE must be https://api.meta.ai");
  }

  const res = await fetch(`${base}/chat/completions`, {
    method: "POST",
    // A hanging provider must not stall the function for its full 60s.
    signal: AbortSignal.timeout(30000),
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      max_tokens: 4096,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: [
            { type: "text", text: "Transcribe this prescription photo. Return JSON only." },
            { type: "image_url", image_url: { url: imageDataUrl } },
          ],
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Meta Model API ${res.status}: ${errText.slice(0, 200)}`);
  }
  const json = await res.json();
  const text = (json?.choices?.[0]?.message?.content || "").trim();
  let data;
  try {
    data = JSON.parse(text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, ""));
  } catch {
    throw new Error("model returned invalid JSON");
  }
  return validateParse(data);
}
