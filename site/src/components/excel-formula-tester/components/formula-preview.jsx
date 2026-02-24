import { FN_CATALOG } from "../function-catalog";

export function FormulaHighlight({ formula, namedConstants = {} }) {
  if (!formula) return null;
  const nameKeys = Object.keys(namedConstants).map((k) => k.toLowerCase());
  const tokens = [];
  let i = 0;
  const s = formula;
  while (i < s.length) {
    if (i === 0 && s[i] === "=") {
      tokens.push(<span key={i} className="ft-hl-eq">=</span>); i++;
    } else if (s[i] === '"') {
      let j = i + 1; while (j < s.length && s[j] !== '"') j++;
      tokens.push(<span key={i} className="ft-hl-str">{s.slice(i, j + 1)}</span>); i = j + 1;
    } else if (/[A-ZÀ-Ü_]/i.test(s[i])) {
      let j = i; while (j < s.length && /[A-ZÀ-Ü0-9._]/i.test(s[j])) j++;
      const w = s.slice(i, j);
      if (FN_CATALOG[w.toUpperCase()])
        tokens.push(<span key={i} className="ft-hl-fn">{w}</span>);
      else if (/^[A-Z]\d{1,2}$/i.test(w))
        tokens.push(<span key={i} className="ft-hl-cell">{w}</span>);
      else if (nameKeys.includes(w.toLowerCase()))
        tokens.push(<span key={i} className="ft-hl-name">{w}</span>);
      else tokens.push(<span key={i} className="ft-hl-text">{w}</span>);
      i = j;
    } else if (/[0-9]/.test(s[i])) {
      let j = i; while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      tokens.push(<span key={i} className="ft-hl-num">{s.slice(i, j)}</span>); i = j;
    } else if ("()".includes(s[i])) {
      tokens.push(<span key={i} className="ft-hl-paren">{s[i]}</span>); i++;
    } else if ("+-*/<>=!&".includes(s[i])) {
      tokens.push(<span key={i} className="ft-hl-op">{s[i]}</span>); i++;
    } else if (";,".includes(s[i])) {
      tokens.push(<span key={i} className="ft-hl-sep">{s[i]}</span>); i++;
    } else {
      tokens.push(<span key={i} className="ft-hl-text">{s[i]}</span>); i++;
    }
  }
  return <div className="ft-syntax-preview">{tokens}</div>;
}