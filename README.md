# Oshudh — prescription reader for Bangladesh

Built for the Meta Global AI Developer Hackathon (indie track, Oct 26 – Nov 4 2026).

Snap a photo of a handwritten prescription → structured medicine list with
confidence scores → auto-generated daily dose schedule → plain-language
explanations. Handles Bangladeshi prescribing shorthand (`1+0+1` =
morning/noon/night), English/Bangla code-mixing, and local brand names.

## Run it

```bash
cd app
npm install
cp .env.example .env   # MODEL_PROVIDER=mock for now
npm run dev            # http://localhost:3000
```

## Project layout

- `app/app/page.js` — the whole UI: upload → parsing → results
- `app/app/api/parse/route.js` — POST `{ image: dataUrl }`, returns parse JSON.
  Keys stay server-side. Provider picked by `MODEL_PROVIDER` env.
- `app/lib/mock.js` — synthetic sample parse (all demo data is invented)
  so the UI works with zero API access.
- `app/lib/providers/meta.js` — stub for the Meta Model API.
- `parse-prompt.md` — the system prompt (v1, tested). Paste as the system
  message with the image when wiring the real model.

## Wiring Meta's API on day 1

1. Get the endpoint URL, auth format, and vision model ID from the hackathon
   kickoff materials / workshops.
2. Fill in `lib/providers/meta.js`: POST the image + `parse-prompt.md` as the
   system message, parse the JSON from the response, validate the schema.
3. Put the key in `app/.env` as `META_API_KEY` (never in client code).
4. Set `MODEL_PROVIDER=meta` in `app/.env`.
5. Test with 3+ real prescription photos before trusting it live.

The UI, schema, and prompt are smoke-tested with synthetic demo data.
Day 1 is a key swap, not a rewrite.

## Testing the parser (eval harness)

```bash
cd app
npm run eval
```

Drop prescription photos in `eval/images/` (they stay local, never committed),
add the expected medicine list as `eval/expected/<same-name>.json`, and one
command scores every image: per-medicine name + schedule accuracy and an
overall percentage. A synthetic expected case (`eval/expected/sample-demo.json`)
is included as a format reference; pair it with a photo of the same basename to
run it. When the real API is wired, this is how you prove the demo set is
bulletproof before going on stage.

## What's next (post-scaffold)

- Bangla explanations per medicine (Muse Spark reasoning call)
- Interaction / allergy safety checks
- Dose reminders (web push)
- Family mode (multiple profiles)
- Demo script + backup images
