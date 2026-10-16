# Building your eval demo set

The goal: 5 to 10 real prescription photos, each with a matching expected
JSON, so `npm run eval` proves the parser is bulletproof before the hackathon.

## How to add a case

1. Photo goes in `eval/images/` — e.g. `presc-02.jpg`. (Stays local,
   never committed. Ask the person before photographing their prescription.)
2. Expected answers go in `eval/expected/presc-02.json` — same basename.
3. Copy this shape (see `sample-demo.json`):

```json
{
  "medicines": [
    {
      "name": "Seclo",
      "schedule": { "morning": "1 capsule", "noon": "none", "night": "none" }
    }
  ]
}
```

Scoring is per medicine: name match counts, then each of morning/noon/night
is scored against your expected value. `"none"` means no dose in that slot.
Write what the doctor actually meant, not what the app should guess.

## What makes a good set

- **Diverse handwriting.** Different doctors, different scrawl. Two photos
  from the same doctor teach you nothing new.
- **The BD shorthand variants.** Get at least one of each: `1+0+1`,
  `1+1+1`, `0+0+1`, half-tablet notes, duration in weeks vs "চলবে".
- **One tricky case.** Faded ink, torn corner, heavy Bangla notes. Your
  demo insurance: if the parser flags low confidence honestly instead of
  guessing, that reads as a feature, not a bug.
- **One clean case.** A clearly written prescription that should score 100%.
  This is your opener on demo day.
- **Common local brands.** Napa, Seclo, Pantonix, Omep, Calbo — the drugs
  judges' families actually take.

## Privacy

Real photos never leave your machine: `eval/images/` is gitignored. The old
zip from before the repo went public still contains a real prescription
photo, so do not redistribute that file. When the demo set is solid, pick
your 3 most reliable cases as the stage set and keep the rest as backup.
