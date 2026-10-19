"use client";

import { useRef, useState } from "react";

const PARSE_STEPS = [
  "Reading the handwriting",
  "Identifying medicines and doses",
  "Decoding the 1+0+1 schedule",
  "Building your daily plan",
];

const CONF_WHY = {
  high: "Clear handwriting, matched a known medicine.",
  medium: "Readable, but double-check the name with your pharmacist.",
  low: "Hard to read. Do not rely on this without verification.",
};

const SLOT_BN = { morning: "সকাল", noon: "দুপুর", night: "রাত" };

function Confidence({ level }) {
  return <span className={`conf ${level}`}>{level}</span>;
}

function MedicineCard({ med, index, open, onToggle }) {
  const slots = [
    { key: "morning", label: "Morning" },
    { key: "noon", label: "Noon" },
    { key: "night", label: "Night" },
  ];
  return (
    <div className={`med${open ? " open" : ""}`}>
      <button className="med-head" onClick={onToggle} aria-expanded={open}>
        <span className="med-index">{String(index + 1).padStart(2, "0")}</span>
        <span>
          <span className="med-name">
            {med.name} <span className="med-strength">{med.strength}</span>
          </span>
          <span className="med-sub">
            {slots
              .filter((s) => med.schedule[s.key] && med.schedule[s.key] !== "none")
              .map((s) => `${s.label}: ${med.schedule[s.key]}`)
              .join("  ·  ")}
          </span>
        </span>
        <span className="med-right">
          <Confidence level={med.confidence} />
          <span className="chev">{open ? "▾" : "▸"}</span>
        </span>
      </button>
      <div className="med-body">
        <div className="med-body-in">
          <div className="slots">
            {slots.map((s) => {
              const val = med.schedule[s.key];
              const on = val && val !== "none";
              return (
                <span key={s.key} className={`slot${on ? " on" : ""}`}>
                  {s.label}
                  <span className="slot-bn">{SLOT_BN[s.key]}</span>
                  {on ? `: ${val}` : ""}
                </span>
              );
            })}
          </div>
          <dl className="med-facts">
            <div>
              <dt>As written</dt>
              <dd className="mono">{med.schedule_raw}</dd>
            </div>
            {med.instruction_note && (
              <div>
                <dt>Note</dt>
                <dd>{med.instruction_note}</dd>
              </div>
            )}
            {med.duration && (
              <div>
                <dt>Duration</dt>
                <dd>{med.duration}</dd>
              </div>
            )}
            <div>
              <dt>Confidence</dt>
              <dd>{CONF_WHY[med.confidence] || med.confidence}</dd>
            </div>
          </dl>
        </div>
      </div>
    </div>
  );
}

function ScheduleView({ medicines, taken, onToggleDose }) {
  const buckets = [
    { key: "morning", label: "Morning" },
    { key: "noon", label: "Noon" },
    { key: "night", label: "Night" },
  ];
  return (
    <div className="sched">
      {buckets.map((b) => {
        const items = medicines
          .map((m, i) => ({ m, i }))
          .filter(({ m }) => m.schedule[b.key] && m.schedule[b.key] !== "none");
        if (!items.length) return null;
        const allTaken = items.every(({ m, i }) => taken[`${i}-${b.key}`]);
        return (
          <div className={`sched-row${allTaken ? " done" : ""}`} key={b.key}>
            <div className="sched-time">
              {b.label}
              <span className="slot-bn big">{SLOT_BN[b.key]}</span>
            </div>
            <div className="sched-meds">
              {items.map(({ m, i }) => {
                const key = `${i}-${b.key}`;
                const isTaken = !!taken[key];
                return (
                  <button
                    key={key}
                    className={`dose${isTaken ? " taken" : ""}`}
                    onClick={() => onToggleDose(key)}
                  >
                    <span className="dose-check">{isTaken ? "✓" : ""}</span>
                    <span>
                      <strong>
                        {m.name} {m.strength}
                      </strong>{" "}
                      — {m.schedule[b.key]}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [preview, setPreview] = useState(null);
  const [phase, setPhase] = useState("idle"); // idle | parsing | done | error
  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [stepsDone, setStepsDone] = useState(0);
  const [openCards, setOpenCards] = useState({ 0: true });
  const [taken, setTaken] = useState({});
  const [reviewed, setReviewed] = useState({});
  const [ixState, setIxState] = useState("idle"); // idle | loading | done | error
  const [ixResult, setIxResult] = useState(null);
  const [ixError, setIxError] = useState("");
  const [speaking, setSpeaking] = useState(false);
  const fileRef = useRef(null);
  const galleryRef = useRef(null);
  const voiceOK =
    typeof window !== "undefined" && "speechSynthesis" in window;

  function onFile(e) {
    const f = e.target.files?.[0];
    if (!f) return;
    // Downscale to max 1600px JPEG before upload: keeps the request under
    // the serverless payload cap and uploads fast on mobile data.
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      try {
        const MAX = 1600;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        setPreview(canvas.toDataURL("image/jpeg", 0.85));
      } catch {
        setError("Could not read that image.");
        setPhase("error");
        URL.revokeObjectURL(url);
        return;
      }
      URL.revokeObjectURL(url);
      setPhase("idle");
      setResult(null);
      setError("");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setError("Could not read that image. Try a JPEG or PNG photo.");
      setPhase("error");
    };
    img.src = url;
  }

  async function parse() {
    if (!preview) return;
    setPhase("parsing");
    setStepsDone(0);
    const timer = setInterval(
      () => setStepsDone((n) => Math.min(n + 1, PARSE_STEPS.length)),
      700
    );
    try {
      const res = await fetch("/api/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: preview }),
      });
      const data = await res.json();
      clearInterval(timer);
      if (!res.ok) throw new Error(data.error || "Parse failed");
      setStepsDone(PARSE_STEPS.length);
      setTimeout(() => {
        setResult(data);
        setOpenCards({ 0: true });
        setTaken({});
        setReviewed({});
        setIxResult(null);
        setIxState("idle");
        setIxError("");
        setPhase("done");
      }, 400);
    } catch (err) {
      clearInterval(timer);
      setError(err.message);
      setPhase("error");
    }
  }

  function reset() {
    if (typeof window !== "undefined" && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
    }
    setSpeaking(false);
    setPreview(null);
    setResult(null);
    setIxResult(null);
    setIxState("idle");
    setIxError("");
    setReviewed({});
    setPhase("idle");
    setError("");
    if (fileRef.current) fileRef.current.value = "";
    if (galleryRef.current) galleryRef.current.value = "";
  }

  const takenCount = Object.values(taken).filter(Boolean).length;

  /* ---------- Bangla voice readout ---------- */
  const BN_DIGIT = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  function bnDose(dose) {
    const m = /^([\d.]+)\s+(tablet|capsule)s?$/i.exec(String(dose).trim());
    if (m) {
      const num = m[1].replace(/[0-9]/g, (d) => BN_DIGIT[+d]);
      return `${num}টি ${m[2].toLowerCase() === "tablet" ? "ট্যাবলেট" : "ক্যাপসুল"}`;
    }
    if (/^half tablet$/i.test(String(dose).trim())) return "অর্ধেক ট্যাবলেট";
    return dose;
  }
  function scheduleSpeech(medicines) {
    const slots = [
      { key: "morning", bn: "সকালে" },
      { key: "noon", bn: "দুপুরে" },
      { key: "night", bn: "রাতে" },
    ];
    const parts = [];
    for (const s of slots) {
      const items = medicines.filter(
        (m) => m.schedule[s.key] && m.schedule[s.key] !== "none"
      );
      if (!items.length) continue;
      parts.push(
        s.bn +
          ": " +
          items
            .map(
              (m) =>
                `${m.name} ${m.strength || ""}`.trim() +
                ", " +
                bnDose(m.schedule[s.key])
            )
            .join("; ")
      );
    }
    return parts.join("। ") + "।";
  }
  function toggleSpeak() {
    if (!voiceOK) return;
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const u = new SpeechSynthesisUtterance(scheduleSpeech(result.medicines));
    u.lang = "bn-BD";
    const bn = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang && v.lang.toLowerCase().startsWith("bn"));
    if (bn) u.voice = bn;
    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    setSpeaking(true);
  }

  /* ---------- drug interaction check ---------- */
  async function checkInteractions() {
    if (!result) return;
    setIxState("loading");
    setIxError("");
    try {
      const res = await fetch("/api/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          medicines: result.medicines.map((m) => ({
            name: m.name,
            strength: m.strength,
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Check failed");
      setIxResult(data);
      setIxState("done");
    } catch (err) {
      setIxError(err.message);
      setIxState("error");
    }
  }

  return (
    <div className="wrap">
      <header className="top">
        <div className="brand">
          Oshudh<small>ওষুধ</small>
        </div>
        <span className="proto-tag">Prototype</span>
      </header>

      {phase !== "done" && (
        <section className="hero">
          <p className="kicker">Prescription reader — Bangladesh</p>
          <h1>
            Can't read your <em>prescription?</em> Snap it.
          </h1>
          <p>
            Oshudh reads handwritten prescriptions, pulls out every medicine
            with its dose and schedule, and explains it in plain language.
          </p>
          <div className="hero-demo">
            <div className="rx-slip">
              <div className="rx-line">
                <span>Napa 500mg</span>
                <span className="rx-dose">1+0+1</span>
              </div>
              <div className="rx-line">
                <span>Seclo 20mg</span>
                <span className="rx-dose">0+0+1</span>
              </div>
              <div className="rx-arrow">↓</div>
              <div className="rx-out">
                Morning: Napa · Night: Napa, Seclo
              </div>
            </div>
            <p className="hero-cap">
              Doctors write <span className="mono">1+0+1</span>. Oshudh reads it.
            </p>
          </div>
        </section>
      )}

      {phase === "idle" && (
        <>
          <div className="upload-row">
            <label className="drop half">
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={onFile}
              />
              <div className="big">Take a photo</div>
              <div className="sub">Opens your camera</div>
            </label>
            <label className="drop half">
              <input
                ref={galleryRef}
                type="file"
                accept="image/*"
                onChange={onFile}
              />
              <div className="big">Choose from gallery</div>
              <div className="sub">An existing photo</div>
            </label>
          </div>
          {preview && (
            <div className="preview">
              <img src={preview} alt="Prescription preview" />
            </div>
          )}
          <button className="btn" disabled={!preview} onClick={parse}>
            Read my prescription
          </button>
        </>
      )}

      {phase === "parsing" && (
        <div className="parsing">
          <div className="spinner" />
          <ul className="steps">
            {PARSE_STEPS.map((s, i) => (
              <li key={s} className={i < stepsDone ? "done" : ""}>
                <span className="tick">{i < stepsDone ? "✓" : "○"}</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {phase === "error" && (
        <>
          <p style={{ marginTop: 24, color: "var(--red)" }}>{error}</p>
          <button className="btn ghost" onClick={reset}>
            Try again
          </button>
        </>
      )}

      {phase === "done" && result && (
        <div className="results">
          {result._provider === "mock" && (
            <p className="demo-notice">
              Demo mode — showing sample medicines, not your prescription.
              Live AI reading activates with an API key.
            </p>
          )}
          <h2 className="section-title">
            Medicines found · {result.medicines.length}
          </h2>
          {result.medicines.map((m, i) => (
            <div className="fade-up" style={{ animationDelay: `${i * 70}ms` }} key={i}>
              <MedicineCard
                med={m}
                index={i}
                open={!!openCards[i]}
                onToggle={() => setOpenCards((o) => ({ ...o, [i]: !o[i] }))}
              />
            </div>
          ))}

          {result.uncertain_spans?.length > 0 && (
            <>
              <h2 className="section-title">Needs your eyes</h2>
              <p className="hint" style={{ marginTop: 0 }}>
                The AI wasn't sure about these. Compare with the photo,
                then tap to mark each one checked.
              </p>
              <ul className="review-list">
                {result.uncertain_spans.map((s, i) => (
                  <li key={i}>
                    <button
                      className={`review${reviewed[i] ? " done" : ""}`}
                      onClick={() =>
                        setReviewed((r) => ({ ...r, [i]: !r[i] }))
                      }
                    >
                      <span className="dose-check">
                        {reviewed[i] ? "✓" : ""}
                      </span>
                      <span>{s}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}

          <h2 className="section-title">
            Today's schedule
            {takenCount > 0 && (
              <span className="taken-count">
                {takenCount} taken
              </span>
            )}
          </h2>
          <ScheduleView
            medicines={result.medicines}
            taken={taken}
            onToggleDose={(key) => setTaken((t) => ({ ...t, [key]: !t[key] }))}
          />
          <p className="hint">Tap a dose to mark it taken.</p>
          {voiceOK && (
            <button className="btn ghost" onClick={toggleSpeak}>
              {speaking ? "Stop reading" : "শুনুন — Listen to today's schedule"}
            </button>
          )}

          <h2 className="section-title">Safety check</h2>
          {ixState === "idle" && (
            <>
              <p className="hint" style={{ marginTop: 0 }}>
                Check these medicines against each other for known interactions.
              </p>
              <button className="btn ghost" onClick={checkInteractions}>
                Check drug interactions
              </button>
            </>
          )}
          {ixState === "loading" && (
            <div className="parsing" style={{ padding: "24px 0" }}>
              <div className="spinner" />
              <p className="hint">Checking known interactions…</p>
            </div>
          )}
          {ixState === "error" && (
            <>
              <p style={{ color: "var(--red)", fontSize: 14 }}>{ixError}</p>
              <button className="btn ghost" onClick={checkInteractions}>
                Try again
              </button>
            </>
          )}
          {ixState === "done" && ixResult && (
            ixResult.interactions.length === 0 ? (
              <p className="med-note">
                No known interactions found among these medicines.
              </p>
            ) : (
              <ul className="ix-list">
                {ixResult.interactions.map((ix, i) => (
                  <li key={i} className={`ix sev-${ix.severity}`}>
                    <span className="ix-sev">{ix.severity}</span>
                    <div>
                      <strong>{ix.drugs.join(" + ")}</strong>
                      <p>{ix.effect}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )
          )}
          {ixState === "done" && (
            <p className="hint">AI-suggested. Always verify with your pharmacist.</p>
          )}

          {result.follow_up && (
            <>
              <h2 className="section-title">Follow-up</h2>
              <div className="med">
                <div className="med-note" style={{ marginTop: 0 }}>
                  <strong>{result.follow_up}</strong>
                  {result.lab_tests?.length > 0 && (
                    <span> · Tests: {result.lab_tests.join(", ")}</span>
                  )}
                </div>
              </div>
            </>
          )}

          <div className="disclaimer">
            <strong>Important</strong>
            AI can misread handwriting. Verify every medicine with your
            pharmacist before taking anything. This is not medical advice.
          </div>

          <button className="btn ghost" onClick={reset}>
            Scan another prescription
          </button>
        </div>
      )}

      <footer className="footer">
        Oshudh prototype · built for the Meta Global AI Developer Hackathon
      </footer>
    </div>
  );
}
