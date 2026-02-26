import { useState, useRef, useCallback } from "react";
import { tryEvaluate, traceEvaluate, SUPPORTED_FUNCTIONS } from "./evaluator.js";
import { FN_CATALOG, EXCEL_FUNCTIONS } from "./function-catalog.js";
import { FormulaHighlight } from "./components/formula-preview.jsx"
import { TracePanel } from "./components/TracePanel.jsx"
import { NamedConstantsPanel } from "./components/named-constants-panel.jsx"
import { Lightbulb, Brain, Search } from "lucide-react";
import ReactMarkdown from "react-markdown";
import "./FormulaTester.css";

const GRID_ROWS = 12;
const GRID_COLS = 10;

// ── Backend API URL ──
const API_BASE = import.meta.env?.PUBLIC_API_BASE || "https://excel-analyzer-22z8.onrender.com";
const colLabel = (i) => String.fromCharCode(65 + i);
const createEmptyGrid = () =>
  Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(""));


// ══════════════════════════════════════════════════════════════════════════════
//  parseFunctionCalls + lintFormula (same logic, cleaner)
// ══════════════════════════════════════════════════════════════════════════════

function parseFunctionCalls(body) {
  const calls = [];
  const fnPattern = /([A-ZÀ-Ü][A-ZÀ-Ü0-9.]*)\s*\(/gi;
  let match;
  while ((match = fnPattern.exec(body)) !== null) {
    const fnName = match[1];
    const openIdx = match.index + match[0].length - 1;
    let depth = 1, i = openIdx + 1, inStr = false;
    while (i < body.length && depth > 0) {
      if (body[i] === '"') inStr = !inStr;
      if (!inStr) {
        if (body[i] === '(') depth++;
        if (body[i] === ')') depth--;
      }
      if (depth > 0) i++;
    }
    if (depth === 0) {
      const argsStr = body.slice(openIdx + 1, i);
      const args = [];
      let argStart = 0, d = 0, s = false;
      for (let j = 0; j <= argsStr.length; j++) {
        if (j < argsStr.length && argsStr[j] === '"') s = !s;
        if (!s && j < argsStr.length) {
          if (argsStr[j] === '(') d++;
          if (argsStr[j] === ')') d--;
        }
        if (j === argsStr.length || (!s && d === 0 && (argsStr[j] === ';' || argsStr[j] === ','))) {
          const arg = argsStr.slice(argStart, j).trim();
          if (arg || args.length > 0 || j < argsStr.length) args.push(arg);
          argStart = j + 1;
        }
      }
      const realArgs = (args.length === 1 && args[0] === "") ? [] : args;
      calls.push({ name: fnName, args: realArgs, raw: argsStr.trim() });
    }
  }
  return calls;
}

function lintFormula(formula, namedConstants = {}) {
  const warnings = [];
  if (!formula || !formula.startsWith("=")) return warnings;
  const body = formula.slice(1);

  // Mismatched parentheses
  let depth = 0, inString = false;
  for (let i = 0; i < body.length; i++) {
    if (body[i] === '"') inString = !inString;
    if (inString) continue;
    if (body[i] === '(') depth++;
    if (body[i] === ')') depth--;
    if (depth < 0)
      warnings.push({ type: "error", msg: `Parenthèse fermante en trop (position ${i + 2})` });
  }
  if (depth > 0)
    warnings.push({ type: "error", msg: `${depth} parenthèse(s) ouvrante(s) non fermée(s)` });

  if (/;;/.test(body)) warnings.push({ type: "warning", msg: "Double point-virgule (;;)" });
  if (/,,/.test(body)) warnings.push({ type: "warning", msg: "Double virgule (,,)" });
  if (/[;,]\s*\)/.test(body))
    warnings.push({ type: "warning", msg: "Séparateur avant ) — argument manquant ?" });
  if (/\)\(/.test(body))
    warnings.push({ type: "warning", msg: "Parenthèses adjacentes )( — opérateur manquant ?" });

  const qc = (body.match(/"/g) || []).length;
  if (qc % 2 !== 0) warnings.push({ type: "error", msg: "Guillemet non fermé" });

  // Named constant references — check for undefined names
  // Strip quoted strings first so we don't flag string literals as identifiers
  const bodyNoStrings = body.replace(/"[^"]*"/g, (m) => " ".repeat(m.length));
  const nameKeys = Object.keys(namedConstants).map((k) => k.toLowerCase());
  const identPattern = /\b([A-ZÀ-Ü_][A-ZÀ-Ü0-9_]*)\b/gi;
  let idMatch;
  while ((idMatch = identPattern.exec(bodyNoStrings)) !== null) {
    const word = idMatch[1];
    if (FN_CATALOG[word.toUpperCase()]) continue;
    if (/^[A-Z]\d{1,2}$/i.test(word)) continue;
    if (/^(VRAI|FAUX|TRUE|FALSE)$/i.test(word)) continue;
    // Might be a named constant reference
    if (word.length > 2 && !nameKeys.includes(word.toLowerCase())) {
      // Could be a function name typo or undefined name
      const close = EXCEL_FUNCTIONS.find(
        (f) => f.toLowerCase() === word.toLowerCase() && f !== word.toUpperCase()
      );
      if (!close) {
        // Only warn if followed by something that isn't ( — that's handled below
        const nextChar = body[idMatch.index + word.length];
        if (nextChar !== '(') {
          warnings.push({ type: "info", msg: `« ${word} » — nom non défini ? Ajoutez-le dans le panneau Constantes nommées.` });
        }
      }
    }
  }

  // Function-level validation
  const fnCalls = parseFunctionCalls(body);
  for (const call of fnCalls) {
    const fn = FN_CATALOG[call.name.toUpperCase()];
    if (!fn) {
      const close = EXCEL_FUNCTIONS.find(
        (f) => f.toLowerCase() === call.name.toLowerCase() && f !== call.name.toUpperCase()
      );
      if (close) {
        warnings.push({ type: "info", msg: `« ${call.name} » — vouliez-vous dire ${close} ?` });
      } else {
        warnings.push({ type: "info", msg: `Fonction « ${call.name} » non reconnue` });
      }
      continue;
    }

    const argc = call.args.length;
    if (argc < fn.min) {
      warnings.push({
        type: "error",
        msg: `${call.name}() attend au moins ${fn.min} argument(s), ${argc} fourni(s)\n↳ ${fn.syntax}`,
      });
    } else if (argc > fn.max) {
      warnings.push({
        type: "error",
        msg: `${call.name}() attend au plus ${fn.max} argument(s), ${argc} fourni(s)\n↳ ${fn.syntax}`,
      });
    }

    if (fn.args && argc > 0 && argc >= fn.min) {
      const types = fn.args.replace("*", "");
      for (let i = 0; i < Math.min(argc, types.length); i++) {
        const expected = types[i];
        const arg = call.args[i];
        if (!arg) continue;
        if (/^[A-Z]+\d+/i.test(arg) || /[:(]/.test(arg)) continue;
        // Skip named constant references
        if (nameKeys.includes(arg.toLowerCase())) continue;

        const isQuoted = /^".*"$/.test(arg);
        const isNumber = /^-?\d+([.,]\d+)?$/.test(arg);

        if (expected === "n" && isQuoted) {
          warnings.push({
            type: "warning",
            msg: `${call.name}() argument ${i + 1} : nombre attendu, texte fourni (${arg})\n↳ ${fn.syntax}`,
          });
        }
        if (expected === "s" && isNumber) {
          warnings.push({
            type: "info",
            msg: `${call.name}() argument ${i + 1} : texte attendu, nombre fourni (${arg})`,
          });
        }
        if (expected === "b" && (isQuoted || isNumber)) {
          warnings.push({
            type: "info",
            msg: `${call.name}() argument ${i + 1} : condition logique attendue, ${isQuoted ? "texte" : "nombre"} fourni`,
          });
        }
      }
    }
  }

  return warnings;
}

// ══════════════════════════════════════════════════════════════════════════════
//  CSV parsing
// ══════════════════════════════════════════════════════════════════════════════

function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  return lines.map((line) => {
    const cells = [];
    let current = "", inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      if (inQuotes) {
        if (line[i] === '"' && line[i + 1] === '"') { current += '"'; i++; }
        else if (line[i] === '"') inQuotes = false;
        else current += line[i];
      } else {
        if (line[i] === '"') inQuotes = true;
        else if (line[i] === ',' || line[i] === ';' || line[i] === '\t') {
          cells.push(current.trim());
          current = "";
        } else current += line[i];
      }
    }
    cells.push(current.trim());
    return cells;
  });
}



// ══════════════════════════════════════════════════════════════════════════════
//  Main App
// ══════════════════════════════════════════════════════════════════════════════

export default function ExcelFormulaTester() {
  const [formula, setFormula] = useState('=SI(ET(A1>=60;A1<80);"Bien";SI(A1>=80;"Excellent";"Insuffisant"))');
  const [grid, setGrid] = useState(() => {
    const g = createEmptyGrid();
    g[0][0] = "75"; g[1][0] = "45"; g[2][0] = "92"; g[3][0] = "60";
    g[0][1] = "100"; g[1][1] = "200"; g[2][1] = "150"; g[3][1] = "175";
    return g;
  });
  const [namedConstants, setNamedConstants] = useState({
    seuil_reussite: "60",
    tps: "0.05",
    tvq: "0.09975",
  });
  const [selectedCell, setSelectedCell] = useState(null);
  const [intention, setIntention] = useState("");
  const [explanation, setExplanation] = useState(null);
  const [details, setDetails] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState("trace");
  const [hoveredFn, setHoveredFn] = useState(null);
  const [leftWidth, setLeftWidth] = useState(50); // percentage
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const formulaFocused = useRef(false);
  const cursorPos = useRef(0);
  const resizing = useRef(false);
  const containerRef = useRef(null);

  // ── Evaluate + trace ──
  const warnings = lintFormula(formula, namedConstants);
  const evalResult = tryEvaluate(formula, grid, namedConstants);
  const { trace } = traceEvaluate(formula, grid, namedConstants);

  // ── Resizable columns ──
  const handleResizeStart = useCallback((e) => {
    e.preventDefault();
    resizing.current = true;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const onMove = (ev) => {
      if (!resizing.current || !containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const x = (ev.clientX || ev.touches?.[0]?.clientX) - rect.left;
      const pct = Math.max(25, Math.min(75, (x / rect.width) * 100));
      setLeftWidth(pct);
    };

    const onUp = () => {
      resizing.current = false;
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onUp);
    };

    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
    document.addEventListener("touchmove", onMove);
    document.addEventListener("touchend", onUp);
  }, []);

  // ── Detect hovered function from cursor position ──
  const handleFormulaSelect = () => {
    const pos = inputRef.current?.selectionStart ?? 0;
    cursorPos.current = pos;
    const text = formula.slice(0, pos);
    const match = text.match(/([A-ZÀ-Ü][A-ZÀ-Ü0-9.]*)\s*\([^)]*$/i);
    if (match) {
      const fn = FN_CATALOG[match[1].toUpperCase()];
      setHoveredFn(fn ? { name: match[1].toUpperCase(), ...fn } : null);
    } else {
      setHoveredFn(null);
    }
  };

  // ── CSV loading ──
  const handleCSV = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const parsed = parseCSV(ev.target.result);
      setGrid((prev) => {
        const next = createEmptyGrid();
        for (let r = 0; r < Math.min(parsed.length, GRID_ROWS); r++)
          for (let c = 0; c < Math.min(parsed[r].length, GRID_COLS); c++)
            next[r][c] = parsed[r][c];
        return next;
      });
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ── Cell click ──
  const handleCellClick = (r, c) => {
    if (formulaFocused.current) {
      const ref = `${colLabel(c)}${r + 1}`;
      const pos = cursorPos.current;
      const newF = formula.slice(0, pos) + ref + formula.slice(pos);
      setFormula(newF);
      const newPos = pos + ref.length;
      cursorPos.current = newPos;
      setTimeout(() => {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(newPos, newPos);
      }, 0);
      return;
    }
    setSelectedCell({ r, c });
  };

  const updateCell = (r, c, val) =>
    setGrid((prev) => { const n = prev.map((row) => [...row]); n[r][c] = val; return n; });

  // ── API payload ──
  const buildPayload = () => {
    const gridCtx = grid.slice(0, 5)
      .map((row, ri) => row.slice(0, 4).map((v, ci) => `${colLabel(ci)}${ri + 1}=${v || "(vide)"}`).join(", "))
      .join("\n");
    const namedCtx = Object.entries(namedConstants)
      .map(([k, v]) => `${k}=${v}`).join(", ");
    return {
      formula,
      course_code: "excel2025",
      grid_context: gridCtx,
      named_constants: namedCtx,
      warnings: warnings.map(w => w.msg),
      eval_result: evalResult,
      intention,
    };
  };

  // ── AI Analysis ──
  const analyzeFormula = async () => {
    setIsAnalyzing(true);
    setDetails(null);
    setActiveTab("explain");
    try {
      const res = await fetch(`${API_BASE}/api/analyze`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      console.log(data.explanation);
      setExplanation(data.explanation);
    } catch (err) {
      setExplanation(`Erreur : ${err.message}\n\nVérifiez que le serveur backend est lancé sur ${API_BASE}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const analyzeDetails = async () => {
    setIsLoadingDetails(true);
    try {
      const res = await fetch(`${API_BASE}/api/analyze/details`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ detail: res.statusText }));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }
      const data = await res.json();
      setDetails(data.explanation);
    } catch (err) {
      setDetails(`Erreur : ${err.message}`);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // ── Render helpers ──
  const renderMarkdown = (text) => {
    return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
      part.startsWith("**") && part.endsWith("**")
        ? <strong key={i}>{part.slice(2, -2)}</strong>
        : <span key={i} dangerouslySetInnerHTML={{ __html: part.replace(/`([^`]+)`/g, '<code>$1</code>') }}></span>
    );
  };

  const tabs = [
    { id: "trace", label: "Déconstruction" },
    { id: "lint", label: "Diagnostic", count: warnings.length },
    { id: "explain", label: "Analyse" },
  ];

  const unsupported = formula.startsWith("=")
    ? formula.slice(1).match(/([A-ZÀ-Ü][A-ZÀ-Ü0-9.]*)\s*\(/gi)
      ?.map(m => m.replace(/\s*\($/, "").toUpperCase())
      .filter(fn => !SUPPORTED_FUNCTIONS.includes(fn))
    : [];

  return (
    <div className="ft-root">
      <div className="ft-container">
        {/* Header */}
        <div className="ft-header">
          <div className="ft-logo">fx</div>
          <div>
            <h1>Testeur de formules Excel</h1>
            <p>Écrivez, testez et analysez vos formules</p>
          </div>
        </div>

        {/* Formula Bar */}
        <div className="ft-formula-bar">
          <div className="ft-formula-row">
            <div className="ft-fx-badge">fx</div>
            <input
              ref={inputRef}
              type="text"
              className="ft-formula-input"
              value={formula}
              onChange={(e) => {
                setFormula(e.target.value);
                cursorPos.current = e.target.selectionStart;
                setExplanation(null);
                setDetails(null);
              }}
              onKeyUp={handleFormulaSelect}
              onClick={handleFormulaSelect}
              placeholder="=SOMME(A1:A4)"
              onFocus={() => { formulaFocused.current = true; }}
              onBlur={() => { setTimeout(() => { formulaFocused.current = false; setHoveredFn(null); }, 200); }}
            />
            <button
              className="ft-btn-analyze"
              onClick={analyzeFormula}
              disabled={isAnalyzing || !formula}
            >{isAnalyzing ? "Analyse en cours…" : "Analyser"}</button>
          </div>

          {/* Syntax tooltip */}
          {hoveredFn && (
            <div className="ft-syntax-tooltip">
              <span className="fn-name">{hoveredFn.syntax}</span>
              <span className="fn-desc">{hoveredFn.desc}</span>
              <span className="fn-args">
                ({hoveredFn.min === hoveredFn.max ? `${hoveredFn.min} arg` : `${hoveredFn.min}–${hoveredFn.max} args`})
              </span>
            </div>
          )}

          {/* Syntax highlight */}
          <FormulaHighlight formula={formula} namedConstants={namedConstants} />

          {/* Intention field */}
          <div className="ft-intention-label">
            <Lightbulb className="ft-lightbulb-icon" size={14} />
            <b>Intention (optionnel)</b> &ndash; Que cherches-tu accomplir ? <span style={{ fontWeight: 400 }}>(aide à valider ta formule)</span>
          </div>
          <input
            type="text"
            className="ft-intention-input"
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            placeholder="Ex: « Additionner les ventes supérieures à 100$ » ou « Classifier la note selon 3 paliers »"
          />

          {/* Result */}
          {formula.startsWith("=") && (
            <div className="ft-result-row">
              <span className="ft-result-label">Résultat :</span>
              <span className={`ft-result-value ${evalResult !== null ? "success" : "fallback"}`}>
                {evalResult !== null
                  ? evalResult
                  : unsupported?.length
                    ? `${unsupported.join(", ")} non supporté localement`
                    : "Évaluation locale non disponible"
                }
              </span>
            </div>
          )}
        </div>

        {/* Main layout: grid + resize + analysis */}
        <div className="ft-main-layout" ref={containerRef}>
          {/* Left column */}
          <div className="ft-left-col" style={{ width: `${leftWidth}%` }}>
            {/* Data Grid */}
            <div className="ft-panel" style={{ flex: 1 }}>
              <div className="ft-panel-header">
                <div className="ft-panel-title">Grille de données</div>
                <div className="ft-grid-actions">
                  <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleCSV} style={{ display: "none" }} />
                  <button className="ft-btn-small" onClick={() => fileRef.current?.click()}>Charger CSV</button>
                  <button className="ft-btn-small danger" onClick={() => setGrid(createEmptyGrid())}>Effacer</button>
                </div>
              </div>
              <div className="ft-panel-body" style={{ padding: "8px 16px 16px" }}>
                <table
                  className="ft-grid-table"
                  onMouseDown={(e) => { if (formulaFocused.current) e.preventDefault(); }}
                >
                  <thead>
                    <tr>
                      <th className="corner"></th>
                      {Array.from({ length: GRID_COLS }, (_, c) => (
                        <th key={c}>{colLabel(c)}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: GRID_ROWS }, (_, r) => (
                      <tr key={r}>
                        <td className="ft-grid-row-num">{r + 1}</td>
                        {Array.from({ length: GRID_COLS }, (_, c) => {
                          const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                          return (
                            <td
                              key={c}
                              className={`ft-grid-cell ${isSelected ? "selected" : r % 2 === 0 ? "even" : "odd"}`}
                              onClick={() => handleCellClick(r, c)}
                            >
                              {isSelected ? (
                                <input
                                  autoFocus
                                  value={grid[r][c]}
                                  onChange={(e) => updateCell(r, c, e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      if (r + 1 < GRID_ROWS) setSelectedCell({ r: r + 1, c });
                                      else setSelectedCell(null);
                                    } else if (e.key === "Tab") {
                                      e.preventDefault();
                                      if (c + 1 < GRID_COLS) setSelectedCell({ r, c: c + 1 });
                                      else if (r + 1 < GRID_ROWS) setSelectedCell({ r: r + 1, c: 0 });
                                    } else if (e.key === "Escape") {
                                      setSelectedCell(null);
                                    }
                                  }}
                                  onBlur={() => setSelectedCell(null)}
                                />
                              ) : (
                                <div className={`ft-grid-cell-display ${grid[r][c] ? "" : "empty"}`}>
                                  {grid[r][c]}
                                </div>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Named Constants */}
            <div className="ft-panel">
              <div className="ft-panel-header">
                <div className="ft-panel-title">Constantes nommées</div>
                <div style={{ fontSize: 11, color: "var(--ft-text-dark)" }}>
                  {Object.keys(namedConstants).length} définie(s)
                </div>
              </div>
              <div className="ft-panel-body" style={{ padding: "10px 16px 14px" }}>
                <NamedConstantsPanel constants={namedConstants} onChange={setNamedConstants} />
              </div>
            </div>
          </div>

          {/* Resize handle */}
          <div
            className={`ft-resize-handle ${resizing.current ? "active" : ""}`}
            onMouseDown={handleResizeStart}
            onTouchStart={handleResizeStart}
          />

          {/* Right column — Analysis Panel */}
          <div className="ft-right-col" style={{ width: `${100 - leftWidth}%` }}>
            <div className="ft-panel" style={{ height: "100%" }}>
              <div className="ft-tabs">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    className={`ft-tab ${activeTab === tab.id ? "active" : ""}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    {tab.label}
                    {tab.count > 0 && (
                      <span className="ft-tab-badge error">{tab.count}</span>
                    )}
                  </button>
                ))}
              </div>

              <div className="ft-panel-body" style={{ flex: 1, minHeight: 300 }}>
                {/* ── Trace / Déconstruction ── */}
                {activeTab === "trace" && <TracePanel trace={trace} />}

                {/* ── Diagnostic ── */}
                {activeTab === "lint" && (
                  <div>
                    {warnings.length === 0 ? (
                      <div className="ft-empty-state">
                        <div className="ft-empty-icon success">✓</div>
                        <div className="ft-empty-title success">Aucun problème détecté</div>
                        <div className="ft-empty-desc">La syntaxe de votre formule semble correcte</div>
                      </div>
                    ) : (
                      <div className="ft-warning-list">
                        {warnings.map((w, i) => (
                          <div key={i} className={`ft-warning-item ${w.type}`}>
                            <span className={`ft-severity-dot ${w.type}`}>●</span>
                            <div>
                              <div className={`ft-warning-type ${w.type}`}>
                                {w.type === "error" ? "Erreur" : w.type === "warning" ? "Avertissement" : "Info"}
                              </div>
                              <div className="ft-warning-msg">{w.msg}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="ft-legend">
                      <div className="ft-legend-title">Coloration syntaxique</div>
                      <div className="ft-legend-items">
                        {[
                          { color: "var(--ft-purple)", label: "Fonctions" },
                          { color: "var(--ft-green)", label: "Cellules" },
                          { color: "var(--ft-purple)", label: "Noms", style: "italic" },
                          { color: "var(--ft-blue-soft)", label: "Nombres" },
                          { color: "var(--ft-yellow)", label: "Texte" },
                          { color: "var(--ft-orange)", label: "Opérateurs" },
                          { color: "var(--ft-pink)", label: "Parenthèses" },
                        ].map((item) => (
                          <div key={item.label} className="ft-legend-item">
                            <span className="ft-legend-dot" style={{ background: item.color, fontStyle: item.style }} />
                            <span className="ft-legend-label">{item.label}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── AI Explanation ── */}
                {activeTab === "explain" && (
                  <div>
                    {isAnalyzing ? (
                      <div className="ft-loading-center">
                        <div className="ft-spinner md" />
                        <div className="ft-loading-text">Analyse en cours…</div>
                      </div>
                    ) : explanation ? (
                      <div>
                        <div className="ft-explanation-text">
                          <ReactMarkdown>{explanation}</ReactMarkdown>
                          {/* {renderMarkdown(explanation)} */}
                        </div>

                        {!details && !isLoadingDetails && (
                          <button className="ft-btn-details" onClick={analyzeDetails}>
                            <Search size={16} className="ft-search-icon" /> Plus de détails — décomposition étape par étape
                          </button>
                        )}

                        {isLoadingDetails && (
                          <div className="ft-loading-row">
                            <div className="ft-spinner sm purple" />
                            <span style={{ fontSize: 13, color: "var(--ft-text-muted)" }}>Décomposition en cours…</span>
                          </div>
                        )}

                        {details && (
                          <div className="ft-details-box">
                            <div className="ft-details-title">Décomposition détaillée</div>
                            <div className="ft-details-text">{renderMarkdown(details)}</div>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="ft-empty-state">
                        <div className="ft-empty-icon info">
                          <Brain size={24} />
                        </div>
                        <div className="ft-empty-title dim">Analyse</div>
                        <div className="ft-empty-desc">
                          Cliquez sur « Analyser » pour obtenir une explication détaillée
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
