// Sample parse output matching the production schema.
// SYNTHETIC demo data, rewritten 2026-10-16. Nothing here comes from a real
// prescription; it exists so the UI can be built before API access.
export const SAMPLE_PARSE = {
  medicines: [
    {
      name: "Seclo",
      strength: "20mg",
      schedule_raw: "1+0+0",
      schedule: { morning: "1 capsule", noon: "none", night: "none" },
      instruction_note: "empty stomach",
      duration: "4 weeks",
      confidence: "high",
    },
    {
      name: "Napa",
      strength: "500mg",
      schedule_raw: "0+1+0",
      schedule: { morning: "none", noon: "1 tablet", night: "none" },
      instruction_note: null,
      duration: null,
      confidence: "high",
    },
    {
      name: "Vitacal",
      strength: "500mg",
      schedule_raw: "1+0+1",
      schedule: { morning: "1 tablet", noon: "none", night: "1 tablet" },
      instruction_note: "after food",
      duration: "1 month",
      confidence: "medium",
    },
    {
      name: "Cardioplex",
      strength: "2.5mg",
      schedule_raw: "0+0+1",
      schedule: { morning: "none", noon: "none", night: "1 tablet" },
      instruction_note: null,
      duration: null,
      confidence: "high",
    },
    {
      name: "Antibac",
      strength: "400mg",
      schedule_raw: "½+0+½",
      schedule: {
        morning: "half tablet",
        noon: "none",
        night: "half tablet",
      },
      instruction_note: null,
      duration: "7 days",
      confidence: "medium",
    },
  ],
  diagnosis: "Demo diagnosis (synthetic)",
  follow_up: "After 2 weeks",
  lab_tests: ["CBC", "FBS"],
  overall_confidence: "high",
  uncertain_spans: ["timing note on Cardioplex", "duration note on Antibac"],
};
