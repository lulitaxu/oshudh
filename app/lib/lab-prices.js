// Typical diagnostic test prices in Dhaka (BDT), private labs.
// These are APPROXIMATE ranges, not live prices — the UI says so.
// Government hospitals / Upazila Health Complexes are consistently the
// cheapest option for basic tests. Safe to import from client code.

export const LAB_TESTS = [
  { keys: ["cbc", "completebloodcount", "bloodcount"], name: "CBC (Complete Blood Count)", price: "৳300–500" },
  { keys: ["esr"], name: "ESR", price: "৳200–350" },
  { keys: ["fbs", "fastingbloodsugar", "fastingglucose"], name: "FBS (Fasting Blood Sugar)", price: "৳150–250" },
  { keys: ["rbs", "randombloodsugar"], name: "RBS (Random Blood Sugar)", price: "৳150–250" },
  { keys: ["hba1c", "a1c", "glycosylatedhb"], name: "HbA1c", price: "৳800–1,200" },
  { keys: ["lipidprofile", "lipid", "cholesterol"], name: "Lipid Profile", price: "৳1,000–1,500" },
  { keys: ["creatinine", "serumcreatinine"], name: "Serum Creatinine", price: "৳300–500" },
  { keys: ["sgpt", "alt"], name: "SGPT (ALT)", price: "৳400–600" },
  { keys: ["tsh", "thyroid"], name: "TSH", price: "৳800–1,200" },
  { keys: ["urinere", "urineroutine", "urine"], name: "Urine R/E", price: "৳200–350" },
  { keys: ["ecg"], name: "ECG", price: "৳300–500" },
  { keys: ["xray", "chestxray", "cxr"], name: "X-ray Chest", price: "৳400–700" },
  { keys: ["usg", "ultrasono", "ultrasound"], name: "USG (Ultrasonogram)", price: "৳1,000–1,600" },
  { keys: ["crp"], name: "CRP", price: "৳800–1,200" },
  { keys: ["ns1", "dengue"], name: "Dengue NS1", price: "৳800–1,200" },
  { keys: ["widal"], name: "Widal Test", price: "৳400–600" },
  { keys: ["hbsag", "hepatitisb"], name: "HBsAg", price: "৳600–900" },
  { keys: ["vitamind", "vitd", "25ohd"], name: "Vitamin D", price: "৳2,000–3,000" },
  { keys: ["electrolyte"], name: "Serum Electrolytes", price: "৳800–1,200" },
];

export function findTestInfo(raw) {
  const n = String(raw || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  if (!n) return null;
  for (const t of LAB_TESTS) {
    if (t.keys.some((k) => n.includes(k))) return t;
  }
  return null;
}

export const CHEAPEST_TIP =
  "Cheapest: a government hospital or Upazila Health Complex — basic tests often cost under ৳200 there.";

export const CHAIN_TIP =
  "Popular, Ibn Sina and LabAid have branches all over Dhaka. Prices vary by branch, call ahead to confirm.";
