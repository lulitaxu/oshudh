// Oshudh eval scorer. Run via ../eval/run.sh (starts the app server first).
// Scores the prescription parser against eval/images/ using expected JSON
// in eval/expected/<same-basename>.json.

import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..");
const IMG_DIR = join(ROOT, "images");
const EXP_DIR = join(ROOT, "expected");
const BASE = `http://localhost:${process.env.EVAL_PORT || 3211}`;

const norm = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9.+]/g, "");

function scoreImage(expected, actual) {
  const expMeds = expected.medicines || [];
  const actMeds = actual.medicines || [];
  const rows = expMeds.map((exp) => {
    const hit = actMeds.find(
      (a) => norm(a.name).includes(norm(exp.name)) || norm(exp.name).includes(norm(a.name))
    );
    if (!hit) return { name: exp.name, found: false, score: 0 };
    let pts = 1;
    let total = 1;
    for (const slot of ["morning", "noon", "night"]) {
      total += 1;
      const e = norm(exp.schedule?.[slot]);
      const a = norm(hit.schedule?.[slot]);
      if (e === a || (e && a && (a.includes(e) || e.includes(a)))) pts += 1;
    }
    return { name: exp.name, found: true, score: pts / total };
  });
  const avg = rows.length ? rows.reduce((s, r) => s + r.score, 0) / rows.length : 0;
  return { rows, avg };
}

const files = (await readdir(IMG_DIR).catch(() => [])).filter((f) =>
  [".jpg", ".jpeg", ".png", ".webp"].includes(extname(f).toLowerCase())
);
if (!files.length) {
  console.log("eval/images/ is empty. Drop prescription photos in,");
  console.log("add expected JSON in eval/expected/<name>.json, and rerun.");
  process.exit(1);
}

const summaries = [];
for (const f of files) {
  const name = basename(f, extname(f));
  const buf = await readFile(join(IMG_DIR, f));
  const mime = extname(f).toLowerCase() === ".png" ? "png" : "jpeg";
  const dataUrl = `data:image/${mime};base64,${buf.toString("base64")}`;

  let parsed;
  try {
    const res = await fetch(BASE + "/api/parse", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ image: dataUrl }),
    });
    parsed = await res.json();
    if (!res.ok) throw new Error(parsed.error || "parse failed");
  } catch (e) {
    console.log(`--- ${f}: ERROR ${e.message}`);
    summaries.push({ file: f, avg: 0 });
    continue;
  }

  let exp;
  try {
    exp = JSON.parse(await readFile(join(EXP_DIR, name + ".json"), "utf8"));
  } catch {
    console.log(`--- ${f}: no expected JSON (eval/expected/${name}.json). Skipped.`);
    continue;
  }

  const { rows, avg } = scoreImage(exp, parsed);
  summaries.push({ file: f, avg });
  console.log(`--- ${f}  score ${(avg * 100).toFixed(0)}%`);
  for (const r of rows) {
    const mark = !r.found ? "MISS" : r.score === 1 ? "ok  " : "PART";
    console.log(`    [${mark}] ${r.name}  ${(r.score * 100).toFixed(0)}%`);
  }
}

const done = summaries.filter((s) => s.avg > 0);
if (done.length) {
  const total = done.reduce((s, x) => s + x.avg, 0) / done.length;
  console.log(`\nOVERALL  ${(total * 100).toFixed(0)}% across ${done.length} image(s)`);
}
