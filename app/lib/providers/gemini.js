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

const CONFIDENCE = new Set(["high", "medium", "low"]);

// Bounds on model-controlled output: counts and string lengths are capped
// in the validators below so a hallucinated or steered response cannot
// produce an unbounded / type-confused API payload.
const MAX_MEDICINES = 100;
const MAX_LIST_ITEMS = 50;

function asString(v, max = 500) {
  return typeof v === "string" ? v.slice(0, max) : null;
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
  const slot = (v) =>
    typeof v === "string" && v.trim() ? v.trim().slice(0, 100) : "none";
  return {
    name: m.name.trim().slice(0, 200),
    strength: asString(m.strength, 100),
    schedule_raw: asString(m.schedule_raw, 100) || "",
    schedule: { morning: slot(s.morning), noon: slot(s.noon), night: slot(s.night) },
    instruction_note: asString(m.instruction_note, 200),
    duration: asString(m.duration, 200),
    confidence: conf,
  };
}

export function validateParse(data) {
  if (!data || !Array.isArray(data.medicines) || data.medicines.length === 0) {
    throw new Error("model returned no medicines");
  }
  if (data.medicines.length > MAX_MEDICINES) {
    throw new Error("model returned too many medicines");
  }
  const overall = String(data.overall_confidence || "").toLowerCase();
  // Vitals are rebuilt from string fields only — never passed through as
  // an arbitrary model-supplied object.
  const vitals =
    data.vitals && typeof data.vitals === "object" && !Array.isArray(data.vitals)
      ? {
          bp: asString(data.vitals.bp, 200),
          other: asString(data.vitals.other, 200),
        }
      : null;
  return {
    medicines: data.medicines.map(cleanMedicine),
    diagnosis: asString(data.diagnosis),
    vitals,
    follow_up: asString(data.follow_up),
    lab_tests: Array.isArray(data.lab_tests)
      ? data.lab_tests
          .filter((t) => typeof t === "string")
          .slice(0, MAX_LIST_ITEMS)
          .map((t) => t.slice(0, 200))
      : [],
    overall_confidence: CONFIDENCE.has(overall) ? overall : "low",
    uncertain_spans: Array.isArray(data.uncertain_spans)
      ? data.uncertain_spans
          .filter((t) => typeof t === "string")
          .slice(0, MAX_LIST_ITEMS)
          .map((t) => t.slice(0, 300))
      : [],
  };
}

export async function geminiParsePrescription(imageDataUrl) {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=]+)$/.exec(
    imageDataUrl || ""
  );
  if (!match) throw new Error("bad image data URL");
  const [, mimeType, b64] = match;

  const data = await geminiJson({
    systemPrompt: SYSTEM_PROMPT,
    parts: [
      { text: "Transcribe this prescription photo. Return JSON only." },
      { inlineData: { mimeType, data: b64 } },
    ],
    temperature: 0.1,
    maxOutputTokens: 4096,
  });
  return validateParse(data);
}

// Generic JSON call with automatic fallback to the lighter model on
// capacity errors (429/503/529). Config errors throw immediately.
export async function geminiJson({ systemPrompt, parts, temperature = 0.2, maxOutputTokens = 2048 }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not set");
  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;

  const models = primary === FALLBACK_MODEL ? [primary] : [primary, FALLBACK_MODEL];
  let lastErr = null;
  for (const model of models) {
    try {
      const text = await callGeminiModel(model, apiKey, {
        systemPrompt,
        parts,
        temperature,
        maxOutputTokens,
      });
      const clean = text
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();
      try {
        return JSON.parse(clean);
      } catch {
        throw new Error("model returned invalid JSON");
      }
    } catch (err) {
      if (!isCapacityError(err)) throw err;
      lastErr = err;
    }
  }
  throw lastErr;
}

// Capacity is classified ONLY by the HTTP status captured structurally
// at the fetch site (or a fetch timeout) — never by matching free text in
// the provider's error body, which used to misclassify e.g. a 400 whose
// body happened to contain "503" and re-spend the call on the fallback.
const CAPACITY_STATUSES = new Set([429, 503, 529]);

function isCapacityError(err) {
  return Boolean(err && CAPACITY_STATUSES.has(err.status));
}

function providerError(status, errText) {
  const err = new Error(`Gemini API ${status}: ${String(errText || "").slice(0, 180)}`);
  err.status = status;
  return err;
}

async function callGeminiModel(model, apiKey, { systemPrompt, parts, temperature, maxOutputTokens }) {
  let res;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
        model
      )}:generateContent`,
      {
        method: "POST",
        // A hanging provider must not stall the function for its full
        // 60s budget; 25s leaves room for one fallback attempt.
        signal: AbortSignal.timeout(25000),
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents: [{ parts }],
          generationConfig: {
            responseMimeType: "application/json",
            temperature,
            maxOutputTokens,
          },
        }),
      }
    );
  } catch (err) {
    if (err && (err.name === "TimeoutError" || err.name === "AbortError")) {
      // Treat a provider hang like a capacity error so the fallback model
      // gets a chance instead of failing the request outright.
      const timeoutErr = new Error("Gemini API request timed out");
      timeoutErr.status = 503;
      throw timeoutErr;
    }
    throw err;
  }

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw providerError(res.status, errText);
  }
  const json = await res.json();
  return (json?.candidates?.[0]?.content?.parts || [])
    .map((p) => p.text || "")
    .join("");
}

// ---- Drug interaction check ----

const IX_PROMPT = `You are a drug-interaction checker for Oshudh, a medication companion app.
Given a list of medicines (Bangladeshi brand names with strengths), list pairwise
interactions that are well established in clinical references.

Rules:
- Report ONLY interactions you are confident are real and documented.
  When unsure, omit the pair entirely. Never invent an interaction.
- Severity: "major" (avoid the combination, seek medical advice promptly),
  "moderate" (monitor closely, tell the doctor), "minor" (usually manageable).
- One plain-language line per interaction: what happens.
- Output JSON only: { "interactions": [ { "drugs": ["A", "B"], "severity": "major|moderate|minor", "effect": "..." } ] }
- If no known interactions, return { "interactions": [] }.
- This is informational, not medical advice.`;

const SEVERITY = new Set(["major", "moderate", "minor"]);
const MAX_INTERACTIONS = 50;
const MAX_EFFECT_CHARS = 500;

function normalizeDrugName(s) {
  return String(s || "").toLowerCase().trim().replace(/\s+/g, " ");
}

// A model-named drug counts as submitted when it matches a submitted
// medicine's name, optionally with the strength appended (or vice versa).
function drugWasSubmitted(drug, submittedNames) {
  const d = normalizeDrugName(drug);
  if (!d) return false;
  return submittedNames.some(
    (name) => d === name || d.startsWith(`${name} `) || name.startsWith(`${d} `)
  );
}

export function validateInteractions(data, submittedMedicines) {
  if (!data || !Array.isArray(data.interactions)) {
    throw new Error("model returned bad interaction data");
  }
  // Provenance check: an interaction may only name medicines that were
  // actually submitted. Entries naming anything else (hallucinated or
  // steered output) are dropped, not surfaced.
  const submittedNames = Array.isArray(submittedMedicines)
    ? submittedMedicines.map((m) => normalizeDrugName(m && m.name)).filter(Boolean)
    : null;
  const interactions = [];
  for (const [i, ix] of data.interactions.entries()) {
    if (interactions.length >= MAX_INTERACTIONS) break;
    if (!ix || typeof ix !== "object") {
      throw new Error(`interaction[${i}]: bad entry`);
    }
    let drugs = Array.isArray(ix.drugs)
      ? ix.drugs.filter((d) => typeof d === "string").map((d) => d.trim().slice(0, 120))
      : [];
    drugs = [...new Set(drugs.filter(Boolean))].slice(0, 3);
    if (submittedNames && !drugs.every((d) => drugWasSubmitted(d, submittedNames))) {
      continue;
    }
    const sev = String(ix.severity || "").toLowerCase();
    if (drugs.length < 2) throw new Error(`interaction[${i}]: needs 2 drugs`);
    if (!SEVERITY.has(sev)) throw new Error(`interaction[${i}]: bad severity`);
    if (typeof ix.effect !== "string" || !ix.effect.trim()) {
      throw new Error(`interaction[${i}]: missing effect`);
    }
    interactions.push({
      drugs,
      severity: sev,
      effect: ix.effect.trim().slice(0, MAX_EFFECT_CHARS),
    });
  }
  return { interactions };
}

export async function checkInteractions(medicines) {
  const list = (medicines || [])
    .map((m) => `${m.name}${m.strength ? ` ${m.strength}` : ""}`.trim())
    .filter(Boolean);
  if (list.length < 2) return { interactions: [] };
  const data = await geminiJson({
    systemPrompt: IX_PROMPT,
    parts: [{ text: `Medicines: ${list.join(", ")}` }],
    temperature: 0.1,
    maxOutputTokens: 2048,
  });
  return validateInteractions(data, medicines);
}
