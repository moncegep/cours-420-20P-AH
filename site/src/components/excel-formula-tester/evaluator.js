/**
 * Évaluateur local de formules Excel (version améliorée)
 *
 * Améliorations v2 :
 *   - SI/IF : évaluation paresseuse (lazy) — seule la branche active est évaluée
 *   - Support des constantes nommées (cellules nommées)
 *   - Mode « trace » pour la déconstruction d'une formule
 *   - Meilleure gestion de SI imbriqué + ET/OU
 *
 * Fonctions supportées :
 *   Math      : SOMME/SUM, MOYENNE/AVERAGE, MIN, MAX, ABS, ARRONDI/ROUND,
 *               TRONQUE/TRUNC, MOD, ENT/INT, RACINE/SQRT, PUISSANCE/POWER
 *   Logique   : SI/IF, ET/AND, OU/OR, NON/NOT, SIERREUR/IFERROR
 *   Comptage  : NB/COUNT, NBVAL/COUNTA, NB.SI/COUNTIF,
 *               SOMME.SI/SUMIF, MOYENNE.SI/AVERAGEIF
 *   Texte     : CONCATENER/CONCAT/CONCATENATE, GAUCHE/LEFT, DROITE/RIGHT,
 *               MAJUSCULE/UPPER, MINUSCULE/LOWER, NOMPROPRE/PROPER,
 *               NBCAR/LEN, STXT/MID, SUPPRESPACE/TRIM, SUBSTITUE/SUBSTITUTE,
 *               TEXTE/TEXT
 */

// ══════════════════════════════════════════════════════════════════════════════
//  Helpers — grille et références
// ══════════════════════════════════════════════════════════════════════════════

const colIndex = (letter) => letter.toUpperCase().charCodeAt(0) - 65;

/**
 * Résout une référence simple (ex: "B3") en valeur depuis la grille.
 */
function resolveCell(ref, grid) {
  const m = ref.match(/^(\$?)([A-Z])(\$?)(\d{1,2})$/i);
  if (!m) return undefined;
  const c = colIndex(m[2]);
  const r = parseInt(m[4]) - 1;
  return grid[r]?.[c] ?? "";
}

/**
 * Expanse une plage (ex: "A1:A4" ou "A1:C2") en tableau de valeurs brutes.
 */
function expandRange(rangeStr, grid) {
  const m = rangeStr.match(/^(\$?)([A-Z])(\$?)(\d{1,2}):(\$?)([A-Z])(\$?)(\d{1,2})$/i);
  if (!m) return null;
  const c1 = colIndex(m[2]), r1 = parseInt(m[4]) - 1;
  const c2 = colIndex(m[6]), r2 = parseInt(m[8]) - 1;
  const values = [];
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
      values.push(grid[r]?.[c] ?? "");
  return values;
}

/**
 * Convertit une valeur en nombre. Retourne NaN si impossible.
 */
function toNumber(val) {
  if (val === "" || val === null || val === undefined) return NaN;
  if (typeof val === "number") return val;
  if (typeof val === "boolean") return val ? 1 : 0;
  const s = String(val).replace(/\s/g, "").replace(",", ".");
  return Number(s);
}

/**
 * Collecte les valeurs numériques depuis les arguments évalués.
 */
function collectNumbers(args) {
  const nums = [];
  for (const arg of args) {
    if (Array.isArray(arg)) {
      for (const v of arg) {
        const n = toNumber(v);
        if (!isNaN(n)) nums.push(n);
      }
    } else {
      const n = toNumber(arg);
      if (!isNaN(n)) nums.push(n);
    }
  }
  return nums;
}

/**
 * Collecte toutes les valeurs brutes (pour NB, etc.)
 */
function collectAll(args) {
  const vals = [];
  for (const arg of args) {
    if (Array.isArray(arg)) vals.push(...arg);
    else vals.push(arg);
  }
  return vals;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Critères style NB.SI / SOMME.SI
// ══════════════════════════════════════════════════════════════════════════════

function parseCriteria(criteria) {
  const s = String(criteria);
  const m = s.match(/^([<>!=]{1,2})\s*(.+)$/);
  if (m) {
    const op = m[1];
    const val = m[2];
    const numVal = toNumber(val);
    return (cell) => {
      const cellNum = toNumber(cell);
      const useNum = !isNaN(numVal) && !isNaN(cellNum);
      switch (op) {
        case ">":  return useNum && cellNum > numVal;
        case ">=": return useNum && cellNum >= numVal;
        case "<":  return useNum && cellNum < numVal;
        case "<=": return useNum && cellNum <= numVal;
        case "<>": return useNum ? cellNum !== numVal : String(cell).toLowerCase() !== val.toLowerCase();
        case "=":  return useNum ? cellNum === numVal : String(cell).toLowerCase() === val.toLowerCase();
        default:   return false;
      }
    };
  }
  const numCrit = toNumber(s);
  if (!isNaN(numCrit)) return (cell) => toNumber(cell) === numCrit;
  return (cell) => String(cell).toLowerCase() === s.toLowerCase();
}

// ══════════════════════════════════════════════════════════════════════════════
//  Tokenizer — avec support des constantes nommées
// ══════════════════════════════════════════════════════════════════════════════

const TOKEN = {
  NUMBER: "NUMBER",
  STRING: "STRING",
  BOOL: "BOOL",
  CELL: "CELL",
  RANGE: "RANGE",
  FUNC: "FUNC",
  NAME: "NAME",       // ← Constante nommée
  OP: "OP",
  LPAREN: "LPAREN",
  RPAREN: "RPAREN",
  SEP: "SEP",
  COMPARE: "COMPARE",
};

function tokenize(expr, namedConstants = {}) {
  const tokens = [];
  let i = 0;
  const nameKeys = Object.keys(namedConstants).map((k) => k.toLowerCase());

  while (i < expr.length) {
    if (/\s/.test(expr[i])) { i++; continue; }

    // String literal
    if (expr[i] === '"') {
      let j = i + 1;
      while (j < expr.length && expr[j] !== '"') j++;
      tokens.push({ type: TOKEN.STRING, value: expr.slice(i + 1, j), raw: expr.slice(i, j + 1) });
      i = j + 1;
      continue;
    }

    // Separators
    if (expr[i] === ";" || expr[i] === ",") {
      tokens.push({ type: TOKEN.SEP, raw: expr[i] }); i++; continue;
    }

    // Parentheses
    if (expr[i] === "(") { tokens.push({ type: TOKEN.LPAREN, raw: "(" }); i++; continue; }
    if (expr[i] === ")") { tokens.push({ type: TOKEN.RPAREN, raw: ")" }); i++; continue; }

    // Comparison operators
    if (expr[i] === "<" && expr[i + 1] === ">") { tokens.push({ type: TOKEN.COMPARE, value: "<>", raw: "<>" }); i += 2; continue; }
    if (expr[i] === "<" && expr[i + 1] === "=") { tokens.push({ type: TOKEN.COMPARE, value: "<=", raw: "<=" }); i += 2; continue; }
    if (expr[i] === ">" && expr[i + 1] === "=") { tokens.push({ type: TOKEN.COMPARE, value: ">=", raw: ">=" }); i += 2; continue; }
    if (expr[i] === "<") { tokens.push({ type: TOKEN.COMPARE, value: "<", raw: "<" }); i++; continue; }
    if (expr[i] === ">") { tokens.push({ type: TOKEN.COMPARE, value: ">", raw: ">" }); i++; continue; }
    if (expr[i] === "=" && expr[i + 1] !== "=") { tokens.push({ type: TOKEN.COMPARE, value: "=", raw: "=" }); i++; continue; }

    // Arithmetic operators
    if ("+-*/^&".includes(expr[i])) {
      tokens.push({ type: TOKEN.OP, value: expr[i], raw: expr[i] }); i++; continue;
    }

    // Numbers (including negative after operator/paren/sep/start)
    if (/[0-9]/.test(expr[i]) || (expr[i] === "-" && (tokens.length === 0 || [TOKEN.LPAREN, TOKEN.SEP, TOKEN.OP, TOKEN.COMPARE].includes(tokens[tokens.length - 1]?.type)))) {
      let j = i;
      if (expr[j] === "-") j++;
      while (j < expr.length && /[0-9.,]/.test(expr[j])) j++;
      const raw = expr.slice(i, j);
      const numStr = raw.replace(",", ".");
      const num = Number(numStr);
      if (!isNaN(num)) {
        tokens.push({ type: TOKEN.NUMBER, value: num, raw });
        i = j; continue;
      }
    }

    // Identifiers: function names, cell refs, ranges, booleans, named constants
    if (/[A-ZÀ-Ü_]/i.test(expr[i])) {
      let j = i;
      while (j < expr.length && /[A-ZÀ-Ü0-9._]/i.test(expr[j])) j++;

      // Check for range (A1:B4, $A$1:$B$4)
      if (expr[j] === ":") {
        let k = j + 1;
        while (k < expr.length && /[A-Z0-9$]/i.test(expr[k])) k++;
        const rangeStr = expr.slice(i, k);
        if (/^\$?[A-Z]\$?\d{1,2}:\$?[A-Z]\$?\d{1,2}$/i.test(rangeStr)) {
          tokens.push({ type: TOKEN.RANGE, value: rangeStr.replace(/\$/g, ""), raw: rangeStr });
          i = k; continue;
        }
      }

      const word = expr.slice(i, j);
      const raw = word;

      // Boolean
      if (/^(VRAI|TRUE)$/i.test(word)) { tokens.push({ type: TOKEN.BOOL, value: true, raw }); i = j; continue; }
      if (/^(FAUX|FALSE)$/i.test(word)) { tokens.push({ type: TOKEN.BOOL, value: false, raw }); i = j; continue; }

      // Cell reference (A1–Z99, $A$1, etc.) — NOT followed by (
      const cellClean = word.replace(/\$/g, "");
      if (/^[A-Z]\d{1,2}$/i.test(cellClean) && expr[j] !== "(") {
        tokens.push({ type: TOKEN.CELL, value: cellClean, raw });
        i = j; continue;
      }

      // Named constant — check before FUNC
      if (nameKeys.includes(word.toLowerCase()) && expr[j] !== "(") {
        tokens.push({ type: TOKEN.NAME, value: word, raw });
        i = j; continue;
      }

      // Function name
      tokens.push({ type: TOKEN.FUNC, value: word.toUpperCase(), raw });
      i = j; continue;
    }

    i++;
  }

  return tokens;
}

// ══════════════════════════════════════════════════════════════════════════════
//  TraceBuilder — arbre de déconstruction hiérarchique
// ══════════════════════════════════════════════════════════════════════════════

class TraceBuilder {
  constructor() {
    this.root = { type: "root", children: [] };
    this.stack = [this.root];
  }
  get current() {
    return this.stack[this.stack.length - 1];
  }
  /** Ajoute un nœud feuille (cellule, nom, plage, littéral) */
  addLeaf(entry) {
    this.current.children.push(entry);
  }
  /** Ouvre un nouveau scope (fonction, SI) — ses enfants seront sous lui */
  openScope(entry) {
    entry.children = entry.children || [];
    this.current.children.push(entry);
    this.stack.push(entry);
  }
  /** Ferme le scope courant en le mettant à jour */
  closeScope(updates = {}) {
    const node = this.stack.pop();
    Object.assign(node, updates);
    return node;
  }
  /** Retourne l'arbre complet (enfants de la racine) */
  getTree() {
    return this.root.children;
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  Recursive descent parser + evaluator
//  — SI/IF uses lazy evaluation for correct nested behavior
//  — Trace arborescente pour la déconstruction de formules imbriquées
// ══════════════════════════════════════════════════════════════════════════════

function evaluate(tokens, grid, namedConstants = {}, traceBuilder = null) {
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = (type) => {
    if (tokens[pos]?.type !== type) throw new Error(`Expected ${type}, got ${tokens[pos]?.type}`);
    return tokens[pos++];
  };

  // Helper: collect raw formula text from token range
  function rawSlice(startPos, endPos) {
    return tokens.slice(startPos, endPos).map((t) => t.raw ?? "").join("");
  }

  // ── Expression (comparisons) ──
  function parseExpr() {
    let left = parseAddSub();
    while (peek()?.type === TOKEN.COMPARE) {
      const op = tokens[pos++].value;
      const right = parseAddSub();
      const l = toNumber(left), r = toNumber(right);
      const useNum = !isNaN(l) && !isNaN(r);
      switch (op) {
        case ">":  left = useNum ? l > r : String(left) > String(right); break;
        case ">=": left = useNum ? l >= r : String(left) >= String(right); break;
        case "<":  left = useNum ? l < r : String(left) < String(right); break;
        case "<=": left = useNum ? l <= r : String(left) <= String(right); break;
        case "=":  left = useNum ? l === r : String(left).toLowerCase() === String(right).toLowerCase(); break;
        case "<>": left = useNum ? l !== r : String(left).toLowerCase() !== String(right).toLowerCase(); break;
      }
    }
    return left;
  }

  // ── Add / Sub / Concat (&) ──
  function parseAddSub() {
    let left = parseMulDiv();
    while (peek()?.type === TOKEN.OP && "+-&".includes(peek().value)) {
      const op = tokens[pos++].value;
      const right = parseMulDiv();
      if (op === "&") left = String(left ?? "") + String(right ?? "");
      else if (op === "+") left = toNumber(left) + toNumber(right);
      else left = toNumber(left) - toNumber(right);
    }
    return left;
  }

  // ── Mul / Div ──
  function parseMulDiv() {
    let left = parsePower();
    while (peek()?.type === TOKEN.OP && "*/".includes(peek().value)) {
      const op = tokens[pos++].value;
      const right = parsePower();
      left = op === "*" ? toNumber(left) * toNumber(right) : toNumber(left) / toNumber(right);
    }
    return left;
  }

  // ── Power (^) ──
  function parsePower() {
    let left = parseUnary();
    while (peek()?.type === TOKEN.OP && peek().value === "^") {
      pos++;
      const right = parseUnary();
      left = Math.pow(toNumber(left), toNumber(right));
    }
    return left;
  }

  // ── Unary minus ──
  function parseUnary() {
    if (peek()?.type === TOKEN.OP && peek().value === "-") {
      pos++;
      return -toNumber(parseAtom());
    }
    return parseAtom();
  }

  // ── Atom ──
  function parseAtom() {
    const tok = peek();
    if (!tok) throw new Error("Unexpected end");

    if (tok.type === TOKEN.NUMBER) {
      pos++;
      if (traceBuilder) {
        traceBuilder.addLeaf({ type: "number", raw: tok.raw, value: tok.value });
      }
      return tok.value;
    }
    if (tok.type === TOKEN.STRING) {
      pos++;
      if (traceBuilder) {
        traceBuilder.addLeaf({ type: "string", raw: tok.raw, value: tok.value });
      }
      return tok.value;
    }
    if (tok.type === TOKEN.BOOL) {
      pos++;
      if (traceBuilder) {
        traceBuilder.addLeaf({ type: "bool", raw: tok.raw, value: tok.value });
      }
      return tok.value;
    }

    if (tok.type === TOKEN.NAME) {
      pos++;
      const key = Object.keys(namedConstants).find(
        (k) => k.toLowerCase() === tok.value.toLowerCase()
      );
      if (key !== undefined) {
        const raw = namedConstants[key];
        const n = toNumber(raw);
        const resolved = isNaN(n) ? raw : n;
        if (traceBuilder) {
          traceBuilder.addLeaf({
            type: "name",
            name: tok.value,
            raw: tok.raw,
            value: resolved,
          });
        }
        return resolved;
      }
      throw new Error(`Nom non défini: ${tok.value}`);
    }

    if (tok.type === TOKEN.CELL) {
      pos++;
      const raw = resolveCell(tok.value, grid);
      const n = toNumber(raw);
      const resolved = isNaN(n) ? raw : n;
      if (traceBuilder) {
        traceBuilder.addLeaf({
          type: "cell",
          ref: tok.value,
          raw: tok.raw,
          value: resolved,
          displayValue: raw === "" ? "(vide)" : String(raw),
        });
      }
      return resolved;
    }

    if (tok.type === TOKEN.RANGE) {
      pos++;
      const vals = expandRange(tok.value, grid);
      if (traceBuilder) {
        traceBuilder.addLeaf({
          type: "range",
          ref: tok.value,
          raw: tok.raw,
          values: vals,
        });
      }
      return vals;
    }

    if (tok.type === TOKEN.LPAREN) {
      pos++;
      const result = parseExpr();
      consume(TOKEN.RPAREN);
      return result;
    }

    if (tok.type === TOKEN.FUNC) {
      return parseFunction();
    }

    throw new Error(`Unexpected token: ${tok.type}`);
  }

  // ── SI/IF with lazy evaluation + arborescent trace ──
  function parseSI() {
    // Open SI scope in trace tree
    if (traceBuilder) {
      traceBuilder.openScope({ type: "si" });
      // Open condition sub-scope
      traceBuilder.openScope({ type: "si-condition", label: "Test" });
    }

    // Parse condition
    const condStart = pos;
    const condition = parseExpr();
    const condEnd = pos;
    const condRaw = rawSlice(condStart, condEnd);

    // Close condition sub-scope
    if (traceBuilder) {
      traceBuilder.closeScope({ raw: condRaw, result: condition });
    }

    consume(TOKEN.SEP);

    const truthy = (typeof condition === "boolean") ? condition : Boolean(condition);

    // ── True branch ──
    if (traceBuilder) {
      traceBuilder.openScope({ type: "si-branch", label: "Si vrai", active: truthy });
    }
    const trueBranchStart = pos;
    let trueVal;
    if (truthy) {
      trueVal = parseExpr();
    } else {
      trueVal = parseExprSafe();
    }
    const trueBranchEnd = pos;
    const trueRaw = rawSlice(trueBranchStart, trueBranchEnd);
    if (traceBuilder) {
      traceBuilder.closeScope({ raw: trueRaw, result: trueVal });
    }

    // ── False branch ──
    let falseRaw = "";
    let falseVal = false;
    if (peek()?.type === TOKEN.SEP) {
      consume(TOKEN.SEP);
      if (traceBuilder) {
        traceBuilder.openScope({ type: "si-branch", label: "Si faux", active: !truthy });
      }
      const falseBranchStart = pos;
      if (!truthy) {
        falseVal = parseExpr();
      } else {
        falseVal = parseExprSafe();
      }
      const falseBranchEnd = pos;
      falseRaw = rawSlice(falseBranchStart, falseBranchEnd);
      if (traceBuilder) {
        traceBuilder.closeScope({ raw: falseRaw, result: falseVal });
      }
    }

    const result = truthy ? trueVal : falseVal;

    // Close SI scope
    if (traceBuilder) {
      traceBuilder.closeScope({
        raw: `SI(${condRaw};${trueRaw}${falseRaw ? ";" + falseRaw : ""})`,
        result,
        conditionResult: condition,
      });
    }

    return result;
  }

  // Safe parse: parses an expression but catches errors (for inactive SI branches)
  function parseExprSafe() {
    try {
      return parseExpr();
    } catch {
      return "#N/A";
    }
  }

  // ── Parse function call ──
  function parseFunction() {
    const nameTok = tokens[pos++];
    const fnName = nameTok.value;
    consume(TOKEN.LPAREN);

    // Special handling for SI/IF — lazy evaluation
    if (fnName === "SI" || fnName === "IF") {
      const result = parseSI();
      consume(TOKEN.RPAREN);
      return result;
    }

    // Open function scope in trace tree
    if (traceBuilder) {
      traceBuilder.openScope({ type: "function", name: fnName });
    }

    // Standard eager evaluation for all other functions
    const args = [];
    const argMeta = [];
    if (peek()?.type !== TOKEN.RPAREN) {
      // For each argument, open a sub-scope so its children are grouped
      if (traceBuilder) traceBuilder.openScope({ type: "fn-arg", index: 0 });
      const aStart = pos;
      args.push(parseExpr());
      const aRaw = rawSlice(aStart, pos);
      if (traceBuilder) traceBuilder.closeScope({ raw: aRaw, result: args[0] });
      argMeta.push(aRaw);

      let argIdx = 1;
      while (peek()?.type === TOKEN.SEP) {
        pos++;
        if (traceBuilder) traceBuilder.openScope({ type: "fn-arg", index: argIdx });
        const aStart2 = pos;
        args.push(parseExpr());
        const aRaw2 = rawSlice(aStart2, pos);
        if (traceBuilder) traceBuilder.closeScope({ raw: aRaw2, result: args[argIdx] });
        argMeta.push(aRaw2);
        argIdx++;
      }
    }
    consume(TOKEN.RPAREN);

    const result = callFunction(fnName, args);

    // Close function scope
    if (traceBuilder) {
      traceBuilder.closeScope({ result, argRaws: argMeta });
    }

    return result;
  }

  // ── Function dispatch ──
  function callFunction(name, args) {
    const fn = name.toUpperCase();

    switch (fn) {
      // ── Math ──────────────────────────────────────────────────────
      case "SOMME":
      case "SUM": {
        const nums = collectNumbers(args);
        return nums.reduce((a, b) => a + b, 0);
      }
      case "MOYENNE":
      case "AVERAGE": {
        const nums = collectNumbers(args);
        return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      }
      case "MIN": {
        const nums = collectNumbers(args);
        return nums.length ? Math.min(...nums) : 0;
      }
      case "MAX": {
        const nums = collectNumbers(args);
        return nums.length ? Math.max(...nums) : 0;
      }
      case "ABS":
        return Math.abs(toNumber(args[0]));
      case "ARRONDI":
      case "ROUND": {
        const n = toNumber(args[0]);
        const d = toNumber(args[1]) || 0;
        const f = Math.pow(10, d);
        return Math.round(n * f) / f;
      }
      case "TRONQUE":
      case "TRUNC": {
        const n = toNumber(args[0]);
        const d = args.length > 1 ? toNumber(args[1]) : 0;
        const f = Math.pow(10, d);
        return Math.trunc(n * f) / f;
      }
      case "ENT":
      case "INT":
        return Math.floor(toNumber(args[0]));
      case "MOD":
        return toNumber(args[0]) % toNumber(args[1]);
      case "RACINE":
      case "SQRT":
        return Math.sqrt(toNumber(args[0]));
      case "PUISSANCE":
      case "POWER":
        return Math.pow(toNumber(args[0]), toNumber(args[1]));

      // ── Logique ───────────────────────────────────────────────────
      // SI/IF handled separately in parseSI() for lazy evaluation
      case "ET":
      case "AND": {
        for (const a of args) {
          if (Array.isArray(a)) {
            for (const v of a) {
              const b = (typeof v === "boolean") ? v : Boolean(toNumber(v));
              if (!b) return false;
            }
          } else {
            const b = (typeof a === "boolean") ? a : Boolean(a);
            if (!b) return false;
          }
        }
        return true;
      }
      case "OU":
      case "OR": {
        for (const a of args) {
          if (Array.isArray(a)) {
            for (const v of a) {
              const b = (typeof v === "boolean") ? v : Boolean(toNumber(v));
              if (b) return true;
            }
          } else {
            const b = (typeof a === "boolean") ? a : Boolean(a);
            if (b) return true;
          }
        }
        return false;
      }
      case "NON":
      case "NOT": {
        const val = args[0];
        return (typeof val === "boolean") ? !val : !Boolean(val);
      }
      case "SIERREUR":
      case "IFERROR":
        return args[0] ?? args[1];

      // ── Comptage ──────────────────────────────────────────────────
      case "NB":
      case "COUNT": {
        const all = collectAll(args);
        return all.filter((v) => v !== "" && !isNaN(toNumber(v))).length;
      }
      case "NBVAL":
      case "COUNTA": {
        const all = collectAll(args);
        return all.filter((v) => v !== "").length;
      }
      case "NB.SI":
      case "COUNTIF": {
        const range = Array.isArray(args[0]) ? args[0] : [args[0]];
        const test = parseCriteria(args[1]);
        return range.filter(test).length;
      }
      case "SOMME.SI":
      case "SUMIF": {
        const range = Array.isArray(args[0]) ? args[0] : [args[0]];
        const test = parseCriteria(args[1]);
        const sumRange = args.length > 2 && Array.isArray(args[2]) ? args[2] : range;
        let total = 0;
        for (let i = 0; i < range.length; i++) {
          if (test(range[i])) {
            const n = toNumber(sumRange[i]);
            if (!isNaN(n)) total += n;
          }
        }
        return total;
      }
      case "MOYENNE.SI":
      case "AVERAGEIF": {
        const range = Array.isArray(args[0]) ? args[0] : [args[0]];
        const test = parseCriteria(args[1]);
        const avgRange = args.length > 2 && Array.isArray(args[2]) ? args[2] : range;
        let total = 0, count = 0;
        for (let i = 0; i < range.length; i++) {
          if (test(range[i])) {
            const n = toNumber(avgRange[i]);
            if (!isNaN(n)) { total += n; count++; }
          }
        }
        return count ? total / count : 0;
      }

      // ── Texte ─────────────────────────────────────────────────────
      case "CONCATENER":
      case "CONCATENATE":
      case "CONCAT":
        return args.map((a) => Array.isArray(a) ? a.join("") : String(a ?? "")).join("");
      case "GAUCHE":
      case "LEFT": {
        const txt = String(args[0] ?? "");
        const n = args.length > 1 ? toNumber(args[1]) : 1;
        return txt.slice(0, n);
      }
      case "DROITE":
      case "RIGHT": {
        const txt = String(args[0] ?? "");
        const n = args.length > 1 ? toNumber(args[1]) : 1;
        return txt.slice(-n);
      }
      case "STXT":
      case "MID": {
        const txt = String(args[0] ?? "");
        const start = toNumber(args[1]) - 1;
        const len = toNumber(args[2]);
        return txt.substr(start, len);
      }
      case "MAJUSCULE":
      case "UPPER":
        return String(args[0] ?? "").toUpperCase();
      case "MINUSCULE":
      case "LOWER":
        return String(args[0] ?? "").toLowerCase();
      case "NOMPROPRE":
      case "PROPER":
        return String(args[0] ?? "").replace(
          /\w\S*/g,
          (t) => t.charAt(0).toUpperCase() + t.slice(1).toLowerCase()
        );
      case "NBCAR":
      case "LEN":
        return String(args[0] ?? "").length;
      case "SUPPRESPACE":
      case "TRIM":
        return String(args[0] ?? "").trim().replace(/\s+/g, " ");
      case "SUBSTITUE":
      case "SUBSTITUTE": {
        const txt = String(args[0] ?? "");
        const old = String(args[1] ?? "");
        const rep = String(args[2] ?? "");
        if (args.length > 3) {
          const n = toNumber(args[3]);
          let count = 0, result = txt;
          let idx = result.indexOf(old);
          while (idx !== -1) {
            count++;
            if (count === n) {
              result = result.slice(0, idx) + rep + result.slice(idx + old.length);
              break;
            }
            idx = result.indexOf(old, idx + old.length);
          }
          return result;
        }
        return txt.split(old).join(rep);
      }
      case "TEXTE":
      case "TEXT":
        return String(args[0] ?? "");

      default:
        throw new Error(`Fonction non supportée: ${fn}`);
    }
  }

  const result = parseExpr();
  if (pos < tokens.length) throw new Error("Unexpected tokens remaining");
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
//  API publique
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Évalue une formule Excel avec les données de la grille.
 * @param {string} formula - La formule (commence par =)
 * @param {string[][]} grid - Grille de données [row][col]
 * @param {Object} namedConstants - Constantes nommées { nom: valeur }
 * @returns {string|null} Le résultat formaté, ou null si l'évaluation échoue
 */
export function tryEvaluate(formula, grid, namedConstants = {}) {
  if (!formula || !formula.startsWith("=")) return formula;
  const body = formula.slice(1).trim();
  if (!body) return null;

  try {
    const tokens = tokenize(body, namedConstants);
    const result = evaluate(tokens, grid, namedConstants);
    return formatResult(result);
  } catch {
    return null;
  }
}

/**
 * Évalue une formule et retourne un arbre de trace pour la déconstruction.
 * @returns {{ result: string|null, trace: Array }} résultat + arbre de trace
 */
export function traceEvaluate(formula, grid, namedConstants = {}) {
  if (!formula || !formula.startsWith("=")) return { result: formula, trace: [] };
  const body = formula.slice(1).trim();
  if (!body) return { result: null, trace: [] };

  const builder = new TraceBuilder();
  try {
    const tokens = tokenize(body, namedConstants);
    const result = evaluate(tokens, grid, namedConstants, builder);
    return { result: formatResult(result), trace: builder.getTree() };
  } catch (err) {
    return { result: null, trace: builder.getTree(), error: err.message };
  }
}

function formatResult(result) {
  if (typeof result === "boolean") return result ? "VRAI" : "FAUX";
  if (typeof result === "number") {
    if (!isFinite(result)) return "#DIV/0!";
    return String(Math.round(result * 1e10) / 1e10);
  }
  return String(result);
}

/**
 * Formate une valeur de trace pour l'affichage.
 */
export function formatTraceValue(val) {
  if (val === null || val === undefined) return "null";
  if (typeof val === "boolean") return val ? "VRAI" : "FAUX";
  if (typeof val === "number") {
    if (!isFinite(val)) return "#DIV/0!";
    return String(Math.round(val * 1e10) / 1e10);
  }
  if (Array.isArray(val)) {
    const preview = val.slice(0, 5).map((v) => v === "" ? '""' : String(v)).join("; ");
    return `{${preview}${val.length > 5 ? "; …" : ""}}`;
  }
  return `"${val}"`;
}

/**
 * Liste des fonctions supportées par l'évaluateur local.
 */
export const SUPPORTED_FUNCTIONS = [
  "SOMME", "SUM", "MOYENNE", "AVERAGE", "MIN", "MAX",
  "ABS", "ARRONDI", "ROUND", "TRONQUE", "TRUNC", "ENT", "INT", "MOD",
  "RACINE", "SQRT", "PUISSANCE", "POWER",
  "SI", "IF", "ET", "AND", "OU", "OR", "NON", "NOT", "SIERREUR", "IFERROR",
  "NB", "COUNT", "NBVAL", "COUNTA", "NB.SI", "COUNTIF",
  "SOMME.SI", "SUMIF", "MOYENNE.SI", "AVERAGEIF",
  "CONCATENER", "CONCATENATE", "CONCAT", "GAUCHE", "LEFT", "DROITE", "RIGHT",
  "STXT", "MID", "MAJUSCULE", "UPPER", "MINUSCULE", "LOWER",
  "NOMPROPRE", "PROPER", "NBCAR", "LEN", "SUPPRESPACE", "TRIM",
  "SUBSTITUE", "SUBSTITUTE", "TEXTE", "TEXT",
];
