// Meta Model API provider — STUB.
// Fill in on hackathon day 1 from the kickoff materials:
//   1. Endpoint URL and auth format for the vision model
//   2. Model ID for the vision-capable model
//   3. Put the key in .env as META_API_KEY (never in client code)
//
// The system prompt lives in ../../parse-prompt.md — paste it as the
// system message and send the prescription image alongside it.
// Expect the JSON schema defined there; validate before returning.

export async function metaParsePrescription(imageDataUrl) {
  const apiKey = process.env.META_API_KEY;
  const modelId = process.env.META_MODEL_ID;
  if (!apiKey || !modelId) {
    throw new Error("META_API_KEY / META_MODEL_ID not set");
  }
  throw new Error(
    "Meta provider not wired yet — see lib/providers/meta.js for day-1 instructions"
  );
}
