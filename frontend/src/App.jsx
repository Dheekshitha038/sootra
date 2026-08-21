import React, { useState, useCallback } from "react";

/* ============================================================
   JIGYASU — frontend prototype
   Mirrors src/services/akinator_engine.py (BayesianAkinatorEngine)
   client-side so the game works standalone tonight.

   TO WIRE UP THE REAL BACKEND LATER:
   Replace callStart() / callAnswer() bodies with fetch() calls to
   GET  /api/v1/akinator/start
   POST /api/v1/akinator/answer
   The GameSessionState shape ({ probabilities, asked_questions })
   already matches src/schemas/game.py exactly, so the rest of the
   component tree needs zero changes.
   ============================================================ */

// ---- Mock data (mirrors entities.json / questions.json shape) ----
// NOTE: entities.json currently sends "regional_names" / "source_texts"
// (plural) but HeritageEntity in entity.py expects "regional_name" /
// "source_text" (singular) — pydantic drops the mismatch silently.
// This file reads both spellings defensively so the UI works either way.

const QUESTIONS = [
  {
    id: "q_epic_mahabharata",
    category: "Epic",
    text: {
      en: "Is this entity primarily associated with the Mahabharata?",
      te: "ఈ పాత్ర మహాభారతంతో సంబంధం కలిగి ఉందా?",
    },
  },
  {
    id: "q_is_serpent",
    category: "Lineage",
    text: {
      en: "Is this entity a Naga or serpent figure?",
      te: "ఈ పాత్ర ఒక నాగరాజు లేదా సర్పమా?",
    },
  },
  {
    id: "q_sarpa_yaga",
    category: "Event",
    text: {
      en: "Was this character targeted in Janamejaya's Sarpa Yaga?",
      te: "ఈ పాత్ర జనమేజయుని సర్పయాగంలో లక్ష్యంగా మారిందా?",
    },
  },
  {
    id: "q_festival",
    category: "Practice",
    text: {
      en: "Is this celebrated as an annual festival today?",
      te: "ఇది నేటికీ వార్షిక పండుగగా జరుపుకుంటారా?",
    },
  },
  {
    id: "q_is_monument",
    category: "Form",
    text: {
      en: "Is this a physical monument or structure?",
      te: "ఇది ఒక భౌతిక కట్టడమా?",
    },
  },
];

const ENTITIES = [
  {
    id: "takshaka",
    canonical_name: "Takshaka",
    regional_name: { te: "తక్షకుడు" },
    category: "Character",
    source_text: ["Mahabharata, Adi Parva"],
    spatial_coordinates: { name: "Hastinapur region", latitude: 29.15, longitude: 78.0 },
    attributes: { q_epic_mahabharata: 1.0, q_is_serpent: 1.0, q_sarpa_yaga: 1.0, q_festival: 0.0, q_is_monument: 0.0 },
  },
  {
    id: "janamejaya",
    canonical_name: "Janamejaya",
    regional_name: { te: "జనమేజయుడు" },
    category: "Character",
    source_text: ["Mahabharata, Adi Parva"],
    spatial_coordinates: { name: "Hastinapur", latitude: 29.17, longitude: 78.02 },
    attributes: { q_epic_mahabharata: 1.0, q_is_serpent: 0.0, q_sarpa_yaga: 0.0, q_festival: 0.0, q_is_monument: 0.0 },
  },
  {
    id: "nagula_chavithi",
    canonical_name: "Nagula Chavithi",
    regional_name: { te: "నాగుల చవితి" },
    category: "Festival",
    source_text: ["Andhra & Telangana regional tradition"],
    spatial_coordinates: { name: "Telangana / Andhra Pradesh", latitude: 17.4, longitude: 78.5 },
    attributes: { q_epic_mahabharata: 0.0, q_is_serpent: 1.0, q_sarpa_yaga: 0.0, q_festival: 1.0, q_is_monument: 0.0 },
  },
  {
    id: "konark_sun_temple",
    canonical_name: "Konark Sun Temple",
    regional_name: { or: "କୋଣାର୍କ ସୂର୍ଯ୍ୟ ମନ୍ଦିର" },
    category: "Monument",
    source_text: ["13th century, Eastern Ganga dynasty"],
    spatial_coordinates: { name: "Konark, Odisha", latitude: 19.89, longitude: 86.09 },
    attributes: { q_epic_mahabharata: 0.0, q_is_serpent: 0.0, q_sarpa_yaga: 0.0, q_festival: 0.0, q_is_monument: 1.0 },
  },
];

function regionalName(entity) {
  const dict = entity.regional_name || entity.regional_names || {};
  const vals = Object.values(dict);
  return vals.length ? vals[0] : null;
}
function sourceTexts(entity) {
  return entity.source_text || entity.source_texts || [];
}

// ---- Engine: direct port of BayesianAkinatorEngine ----
class Engine {
  constructor(entities, questions) {
    this.entities = entities;
    this.questions = Object.fromEntries(questions.map((q) => [q.id, q]));
    this.questionIds = questions.map((q) => q.id);
    this.matrix = entities.map((e) => this.questionIds.map((qid) => (qid in e.attributes ? e.attributes[qid] : 0.5)));
  }
  entropy(probs) {
    let h = 0;
    for (const p of probs) if (p > 1e-9) h -= p * Math.log2(p);
    return h;
  }
  updateBeliefs(probs, questionId, answer) {
    const weightMap = { yes: 1.0, probably: 0.75, unknown: 0.5, probably_not: 0.25, no: 0.0 };
    const target = weightMap[answer] ?? 0.5;
    const qIdx = this.questionIds.indexOf(questionId);
    const updated = probs.map((p, i) => (1 - Math.abs(this.matrix[i][qIdx] - target)) * p);
    const total = updated.reduce((a, b) => a + b, 0);
    if (total > 0) return updated.map((v) => v / total);
    return probs.map(() => 1 / probs.length);
  }
  getNextBestQuestion(probs, askedIds) {
    const currentH = this.entropy(probs);
    let bestGain = -1;
    let bestQ = null;
    this.questionIds.forEach((qid, j) => {
      if (askedIds.includes(qid)) return;
      const pYes = probs.reduce((sum, p, i) => sum + p * this.matrix[i][j], 0);
      const pNo = 1 - pYes;
      if (pYes < 1e-5 || pNo < 1e-5) return;
      const postYes = probs.map((p, i) => (p * this.matrix[i][j]) / pYes);
      const postNo = probs.map((p, i) => (p * (1 - this.matrix[i][j])) / pNo);
      const expectedH = pYes * this.entropy(postYes) + pNo * this.entropy(postNo);
      const gain = currentH - expectedH;
      if (gain > bestGain) {
        bestGain = gain;
        bestQ = qid;
      }
    });
    return bestQ ? this.questions[bestQ] : null;
  }
  getTopPrediction(probs) {
    let topIdx = 0;
    probs.forEach((p, i) => {
      if (p > probs[topIdx]) topIdx = i;
    });
    return { entity: this.entities[topIdx], confidence: probs[topIdx] };
  }
}

const engine = new Engine(ENTITIES, QUESTIONS);

// ---- API layer (swap these two functions for real fetch calls) ----
async function callStart() {
  const initial = ENTITIES.map(() => 1 / ENTITIES.length);
  const firstQuestion = engine.getNextBestQuestion(initial, []);
  return { session_state: { probabilities: initial, asked_questions: [] }, first_question: firstQuestion, is_finished: false };
}
async function callAnswer(sessionState, questionId, answer) {
  const asked = [...sessionState.asked_questions, questionId];
  const newProbs = engine.updateBeliefs(sessionState.probabilities, questionId, answer);
  const { entity, confidence } = engine.getTopPrediction(newProbs);
  if (confidence > 0.85) {
    return { session_state: { probabilities: newProbs, asked_questions: asked }, next_question: null, is_finished: true, confidence, prediction: entity };
  }
  const nextQuestion = engine.getNextBestQuestion(newProbs, asked);
  if (!nextQuestion) {
    return { session_state: { probabilities: newProbs, asked_questions: asked }, next_question: null, is_finished: true, confidence, prediction: entity };
  }
  return { session_state: { probabilities: newProbs, asked_questions: asked }, next_question: nextQuestion, is_finished: false, confidence, prediction: null };
}

// ---- Map projection (stylized, not survey-accurate) ----
const BOUNDS = { latMin: 6, latMax: 37, lonMin: 68, lonMax: 97 };
function project(lat, lon) {
  const x = ((lon - BOUNDS.lonMin) / (BOUNDS.lonMax - BOUNDS.lonMin)) * 340 + 40;
  const y = (1 - (lat - BOUNDS.latMin) / (BOUNDS.latMax - BOUNDS.latMin)) * 420 + 30;
  return { x, y };
}

// ============================================================
// UI PIECES
// ============================================================

function Flame({ confidence }) {
  const scale = 0.55 + confidence * 0.7;
  const glow = 8 + confidence * 26;
  return (
    <svg width="52" height="72" viewBox="0 0 52 72" aria-hidden="true">
      <ellipse cx="26" cy="64" rx="16" ry="5" fill="#3A2E22" opacity="0.6" />
      <g style={{ transform: `translate(26px, 46px) scale(${scale})`, transformOrigin: "26px 46px", transition: "transform 0.6s ease" }}>
        <path d="M0 -34 C 10 -18, 12 -6, 0 8 C -12 -6, -10 -18, 0 -34 Z" fill="url(#flameGrad)" style={{ filter: `drop-shadow(0 0 ${glow}px #E7A542)` }} />
      </g>
      <rect x="18" y="46" width="16" height="18" rx="2" fill="#8A6A3C" />
      <rect x="12" y="60" width="28" height="6" rx="2" fill="#5A4426" />
      <defs>
        <linearGradient id="flameGrad" x1="0" y1="-34" x2="0" y2="8" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#FFD98A" />
          <stop offset="55%" stopColor="#E7A542" />
          <stop offset="100%" stopColor="#C9522A" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function ScrollCard({ children, style }) {
  return (
    <div
      style={{
        background: "linear-gradient(180deg, #F1E7D2 0%, #E9DBB8 100%)",
        clipPath:
          "polygon(0% 2%, 2% 0%, 98% 0%, 100% 2%, 100% 98%, 98% 100%, 2% 100%, 0% 98%, 0% 6%, 1% 5%, 0% 4%)",
        boxShadow: "0 18px 40px rgba(0,0,0,0.45), inset 0 0 0 1px rgba(90,42,39,0.15)",
        borderRadius: 6,
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function Landing({ onStart }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 560, gap: 28, padding: "40px 20px", textAlign: "center" }}>
      <div style={{ fontFamily: "'Yatra One', cursive", fontSize: 15, letterSpacing: 4, color: "#C9A227", textTransform: "uppercase" }}>
        सूत्र · Sootra
      </div>
      <h1 style={{ fontFamily: "'Yatra One', cursive", fontSize: 56, color: "#F1E7D2", margin: 0, lineHeight: 1.1 }}>Jigyasu</h1>
      <p style={{ fontFamily: "'Karla', sans-serif", color: "#C9BBA0", maxWidth: 420, fontSize: 16, lineHeight: 1.6, margin: 0 }}>
        Think of a figure, a festival, a monument — anything from India's living past.
        Answer a few questions. Watch the flame steady as Jigyasu narrows in.
      </p>
      <button
        onClick={onStart}
        style={{
          fontFamily: "'Karla', sans-serif",
          fontWeight: 700,
          fontSize: 15,
          letterSpacing: 1,
          textTransform: "uppercase",
          background: "linear-gradient(180deg,#E7C567,#C9A227)",
          color: "#211C18",
          border: "none",
          borderRadius: 4,
          padding: "16px 40px",
          cursor: "pointer",
          boxShadow: "0 10px 24px rgba(201,162,39,0.35)",
        }}
      >
        Begin
      </button>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#6B5E4E" }}>
        {ENTITIES.length} entities loaded · prototype dataset
      </div>
    </div>
  );
}

const ANSWER_OPTIONS = [
  { key: "yes", label: "Yes" },
  { key: "probably", label: "Probably" },
  { key: "unknown", label: "Don't know" },
  { key: "probably_not", label: "Probably not" },
  { key: "no", label: "No" },
];

function GameScreen({ session, question, confidence, lang, setLang, onAnswer, loading }) {
  const askedCount = session.asked_questions.length;
  return (
    <div style={{ padding: "28px 20px 40px", display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
      <div style={{ display: "flex", justifyContent: "space-between", width: "100%", maxWidth: 460, alignItems: "center" }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8A7A5E" }}>
          question {askedCount + 1}
        </span>
        <div style={{ display: "flex", gap: 6 }}>
          {["en", "te"].map((l) => (
            <button
              key={l}
              onClick={() => setLang(l)}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 11,
                padding: "4px 10px",
                borderRadius: 3,
                border: "1px solid #4A3A2A",
                background: lang === l ? "#C9A227" : "transparent",
                color: lang === l ? "#211C18" : "#8A7A5E",
                cursor: "pointer",
              }}
            >
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      <Flame confidence={confidence} />
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8A7A5E" }}>
        certainty {(confidence * 100).toFixed(0)}%
      </div>

      <ScrollCard style={{ padding: "36px 30px", width: "100%", maxWidth: 460, minHeight: 120, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ fontFamily: "'Lora', serif", fontSize: 20, color: "#2B2118", textAlign: "center", margin: 0, lineHeight: 1.5 }}>
          {question ? question.text[lang] || question.text.en : "…"}
        </p>
      </ScrollCard>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, justifyContent: "center", maxWidth: 460 }}>
        {ANSWER_OPTIONS.map((opt) => (
          <button
            key={opt.key}
            disabled={loading}
            onClick={() => onAnswer(opt.key)}
            style={{
              fontFamily: "'Karla', sans-serif",
              fontSize: 14,
              fontWeight: 600,
              padding: "12px 20px",
              borderRadius: 4,
              border: "1px solid #5A2A27",
              background: opt.key === "yes" ? "#3E6B4F" : opt.key === "no" ? "#5A2A27" : "#2B2420",
              color: "#F1E7D2",
              cursor: loading ? "default" : "pointer",
              opacity: loading ? 0.5 : 1,
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {askedCount > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, justifyContent: "center", maxWidth: 460, marginTop: 6 }}>
          {session.asked_questions.map((qid) => (
            <span key={qid} style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#6B5E4E", border: "1px solid #4A3A2A", borderRadius: 3, padding: "2px 6px" }}>
              {qid.replace("q_", "").replace(/_/g, " ")}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function RevealScreen({ prediction, confidence, onExplore, onRestart }) {
  const rname = regionalName(prediction);
  const sources = sourceTexts(prediction);
  return (
    <div style={{ padding: "36px 20px 44px", display: "flex", flexDirection: "column", alignItems: "center", gap: 22 }}>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8A7A5E", letterSpacing: 2, textTransform: "uppercase" }}>
        Jigyasu believes it is
      </div>
      <ScrollCard style={{ padding: "34px 32px", width: "100%", maxWidth: 460, textAlign: "center" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#5A2A27", textTransform: "uppercase", letterSpacing: 1, marginBottom: 6 }}>
          {prediction.category}
        </div>
        <h2 style={{ fontFamily: "'Yatra One', cursive", fontSize: 34, color: "#2B2118", margin: "0 0 6px" }}>{prediction.canonical_name}</h2>
        {rname && <div style={{ fontFamily: "'Lora', serif", fontSize: 16, color: "#5A4426", marginBottom: 14 }}>{rname}</div>}
        {sources.length > 0 && (
          <div style={{ fontFamily: "'Lora', serif", fontSize: 13, color: "#6B5E4E", fontStyle: "italic" }}>
            Source: {sources.join(" · ")}
          </div>
        )}
      </ScrollCard>
      <Flame confidence={confidence} />
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: "#8A7A5E" }}>
        confidence {(confidence * 100).toFixed(0)}%
      </div>
      <div style={{ display: "flex", gap: 12, marginTop: 8 }}>
        <button
          onClick={onExplore}
          style={{ fontFamily: "'Karla', sans-serif", fontWeight: 700, fontSize: 14, background: "linear-gradient(180deg,#E7C567,#C9A227)", color: "#211C18", border: "none", borderRadius: 4, padding: "13px 26px", cursor: "pointer" }}
        >
          See on Map &amp; Timeline
        </button>
        <button
          onClick={onRestart}
          style={{ fontFamily: "'Karla', sans-serif", fontWeight: 600, fontSize: 14, background: "transparent", color: "#C9BBA0", border: "1px solid #4A3A2A", borderRadius: 4, padding: "13px 22px", cursor: "pointer" }}
        >
          Play again
        </button>
      </div>
    </div>
  );
}

function MapTimeline({ entity, onBack, onRestart }) {
  const coords = entity.spatial_coordinates;
  const pin = coords ? project(coords.latitude, coords.longitude) : null;
  const sources = sourceTexts(entity);

  return (
    <div style={{ padding: "28px 20px 44px", display: "flex", flexDirection: "column", alignItems: "center", gap: 26 }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A7A5E", textTransform: "uppercase", letterSpacing: 1 }}>
          Cultural map &amp; timeline
        </div>
        <h2 style={{ fontFamily: "'Yatra One', cursive", fontSize: 28, color: "#F1E7D2", margin: "4px 0 0" }}>{entity.canonical_name}</h2>
      </div>

      <div style={{ position: "relative", width: 400, maxWidth: "100%" }}>
        <svg viewBox="0 0 400 480" width="100%" style={{ background: "#1B2624", borderRadius: 8, border: "1px solid #2E4A44" }}>
          <path
            d="M 150 40 C 220 30, 300 60, 320 130 C 335 175, 300 200, 310 250 C 320 300, 280 330, 290 380 C 296 410, 270 440, 250 430 C 230 420, 220 390, 195 400 C 170 410, 150 440, 120 420 C 95 405, 100 370, 80 340 C 60 310, 70 260, 55 220 C 42 185, 60 150, 70 110 C 80 70, 110 45, 150 40 Z"
            fill="#233F3A"
            stroke="#3E6B4F"
            strokeWidth="1.5"
          />
          {pin && (
            <g>
              <circle cx={pin.x} cy={pin.y} r="7" fill="#C9522A" stroke="#F1E7D2" strokeWidth="1.5" />
              <circle cx={pin.x} cy={pin.y} r="14" fill="none" stroke="#C9522A" strokeWidth="1" opacity="0.5" />
            </g>
          )}
        </svg>
        {pin && (
          <div style={{ position: "absolute", left: `${(pin.x / 400) * 100}%`, top: `${(pin.y / 480) * 100 + 3}%`, transform: "translate(-50%, 0)", fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#C9522A", whiteSpace: "nowrap" }}>
            {coords.name}
          </div>
        )}
        <div style={{ position: "absolute", bottom: 6, right: 8, fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: "#4A6A62" }}>
          stylized · prototype
        </div>
      </div>

      <div style={{ width: "100%", maxWidth: 460 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: "#8A7A5E", textTransform: "uppercase", letterSpacing: 1, marginBottom: 10 }}>
          Timeline · attested in
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {(sources.length ? sources : ["No source text recorded"]).map((s, i) => (
            <div key={i} style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <div style={{ width: 10, height: 10, borderRadius: "50%", background: "#C9A227", marginTop: 4 }} />
                {i < sources.length - 1 && <div style={{ width: 1, flex: 1, background: "#4A3A2A", minHeight: 30 }} />}
              </div>
              <div style={{ paddingBottom: 22 }}>
                <div style={{ fontFamily: "'Lora', serif", fontSize: 14, color: "#F1E7D2" }}>{s}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: "#5A4E3E", marginTop: -8 }}>
          note: dated era/timeline field not yet in schema — placeholder nodes from source_text
        </div>
      </div>

      <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
        <button onClick={onBack} style={{ fontFamily: "'Karla', sans-serif", fontWeight: 600, fontSize: 14, background: "transparent", color: "#C9BBA0", border: "1px solid #4A3A2A", borderRadius: 4, padding: "12px 20px", cursor: "pointer" }}>
          Back to reveal
        </button>
        <button onClick={onRestart} style={{ fontFamily: "'Karla', sans-serif", fontWeight: 700, fontSize: 14, background: "linear-gradient(180deg,#E7C567,#C9A227)", color: "#211C18", border: "none", borderRadius: 4, padding: "12px 24px", cursor: "pointer" }}>
          Play again
        </button>
      </div>
    </div>
  );
}

// ============================================================
// ROOT
// ============================================================

export default function App() {
  const [screen, setScreen] = useState("landing");
  const [session, setSession] = useState({ probabilities: [], asked_questions: [] });
  const [question, setQuestion] = useState(null);
  const [confidence, setConfidence] = useState(0);
  const [prediction, setPrediction] = useState(null);
  const [lang, setLang] = useState("en");
  const [loading, setLoading] = useState(false);

  const start = useCallback(async () => {
    setLoading(true);
    const res = await callStart();
    setSession(res.session_state);
    setQuestion(res.first_question);
    setConfidence(1 / ENTITIES.length);
    setPrediction(null);
    setScreen("game");
    setLoading(false);
  }, []);

  const answer = useCallback(
    async (ans) => {
      if (!question) return;
      setLoading(true);
      const res = await callAnswer(session, question.id, ans);
      setSession(res.session_state);
      setConfidence(res.confidence);
      if (res.is_finished) {
        setPrediction(res.prediction);
        setScreen("reveal");
      } else {
        setQuestion(res.next_question);
      }
      setLoading(false);
    },
    [session, question]
  );

  const restart = useCallback(() => {
    setScreen("landing");
    setSession({ probabilities: [], asked_questions: [] });
    setQuestion(null);
    setPrediction(null);
    setConfidence(0);
  }, []);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "radial-gradient(ellipse at top, #2B2420 0%, #1A1512 70%)",
        display: "flex",
        justifyContent: "center",
      }}
    >
      <div style={{ width: "100%", maxWidth: 560 }}>
        {screen === "landing" && <Landing onStart={start} />}
        {screen === "game" && (
          <GameScreen session={session} question={question} confidence={confidence} lang={lang} setLang={setLang} onAnswer={answer} loading={loading} />
        )}
        {screen === "reveal" && prediction && (
          <RevealScreen prediction={prediction} confidence={confidence} onExplore={() => setScreen("map")} onRestart={restart} />
        )}
        {screen === "map" && prediction && <MapTimeline entity={prediction} onBack={() => setScreen("reveal")} onRestart={restart} />}
      </div>
    </div>
  );
}