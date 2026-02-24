/**
 * Évaluateur local de formules Excel
 * Supporte un sous-ensemble de fonctions pour le feedback immédiat.
 *
 * Fonctions supportées :
 *   Math      : SOMME/SUM, MOYENNE/AVERAGE, MIN, MAX, ABS, ARRONDI/ROUND, TRONQUE/TRUNC, MOD, ENT/INT
 *   Logique   : SI/IF, ET/AND, OU/OR, NON/NOT
 *   Comptage  : NB/COUNT, NB.SI/COUNTIF, SOMME.SI/SUMIF, MOYENNE.SI/AVERAGEIF
 *   Texte     : CONCATENER/CONCAT/CONCATENATE, GAUCHE/LEFT, DROITE/RIGHT,
 *               MAJUSCULE/UPPER, MINUSCULE/LOWER, NOMPROPRE/PROPER, NBCAR/LEN, STXT/MID
 */

// ══════════════════════════════════════════════════════════════════════════════
//  Helpers — grille et références
// ══════════════════════════════════════════════════════════════════════════════

const colIndex = (letter) => letter.toUpperCase().charCodeAt(0) - 65;

/**
 * Résout une référence simple (ex: "B3") en valeur depuis la grille.
 * Retourne la string brute de la cellule.
 */
function resolveCell(ref, grid) {
  const m = ref.match(/^([A-Z])(\d{1,2})$/i);
  if (!m) return undefined;
  const c = colIndex(m[1]);
  const r = parseInt(m[2]) - 1;
  return grid[r]?.[c] ?? "";
}

/**
 * Expanse une plage (ex: "A1:A4" ou "A1:C2") en tableau de valeurs brutes.
 */
function expandRange(rangeStr, grid) {
  const m = rangeStr.match(/^([A-Z])(\d{1,2}):([A-Z])(\d{1,2})$/i);
  if (!m) return null;
  const c1 = colIndex(m[1]), r1 = parseInt(m[2]) - 1;
  const c2 = colIndex(m[3]), r2 = parseInt(m[4]) - 1;
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
  const n = Number(s);
  return n;
}

/**
 * Collecte les valeurs numériques depuis les arguments évalués.
 * Chaque argument peut être un nombre, une string (ref de cellule déjà résolue),
 * ou un tableau (plage expansée).
 */
function collectNumbers(args, grid) {
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
//  Supporte : ">10", ">=5", "<3", "<>0", "=texte", "texte", 10
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
  // Valeur directe — comparaison exacte
  const numCrit = toNumber(s);
  if (!isNaN(numCrit)) {
    return (cell) => toNumber(cell) === numCrit;
  }
  // Comparaison texte insensible à la casse
  return (cell) => String(cell).toLowerCase() === s.toLowerCase();
}

// ══════════════════════════════════════════════════════════════════════════════
//  Tokenizer
// ══════════════════════════════════════════════════════════════════════════════

const TOKEN = {
  NUMBER: "NUMBER",
  STRING: "STRING",
  BOOL: "BOOL",
  CELL: "CELL",
  RANGE: "RANGE",
  FUNC: "FUNC",
  OP: "OP",
  LPAREN: "LPAREN",
  RPAREN: "RPAREN",
  SEP: "SEP",
  COMPARE: "COMPARE",
};

function tokenize(expr) {
  const tokens = [];
  let i = 0;

  while (i < expr.length) {
    // Whitespace
    if (/\s/.test(expr[i])) { i++; continue; }

    // String literal
    if (expr[i] === '"') {
      let j = i + 1;
      while (j < expr.length && expr[j] !== '"') j++;
      tokens.push({ type: TOKEN.STRING, value: expr.slice(i + 1, j) });
      i = j + 1;
      continue;
    }

    // Separators
    if (expr[i] === ";" || expr[i] === ",") {
      tokens.push({ type: TOKEN.SEP }); i++; continue;
    }

    // Parentheses
    if (expr[i] === "(") { tokens.push({ type: TOKEN.LPAREN }); i++; continue; }
    if (expr[i] === ")") { tokens.push({ type: TOKEN.RPAREN }); i++; continue; }

    // Comparison operators (before single < > =)
    if (expr[i] === "<" && expr[i + 1] === ">") { tokens.push({ type: TOKEN.COMPARE, value: "<>" }); i += 2; continue; }
    if (expr[i] === "<" && expr[i + 1] === "=") { tokens.push({ type: TOKEN.COMPARE, value: "<=" }); i += 2; continue; }
    if (expr[i] === ">" && expr[i + 1] === "=") { tokens.push({ type: TOKEN.COMPARE, value: ">=" }); i += 2; continue; }
    if (expr[i] === "<") { tokens.push({ type: TOKEN.COMPARE, value: "<" }); i++; continue; }
    if (expr[i] === ">") { tokens.push({ type: TOKEN.COMPARE, value: ">" }); i++; continue; }
    if (expr[i] === "=" && expr[i + 1] !== "=") { tokens.push({ type: TOKEN.COMPARE, value: "=" }); i++; continue; }

    // Arithmetic operators
    if ("+-*/^&".includes(expr[i])) {
      tokens.push({ type: TOKEN.OP, value: expr[i] }); i++; continue;
    }

    // Numbers
    if (/[0-9]/.test(expr[i]) || (expr[i] === "-" && (tokens.length === 0 || tokens[tokens.length - 1].type === TOKEN.LPAREN || tokens[tokens.length - 1].type === TOKEN.SEP || tokens[tokens.length - 1].type === TOKEN.OP))) {
      let j = i;
      if (expr[j] === "-") j++;
      while (j < expr.length && /[0-9.,]/.test(expr[j])) j++;
      const numStr = expr.slice(i, j).replace(",", ".");
      const num = Number(numStr);
      if (!isNaN(num)) {
        tokens.push({ type: TOKEN.NUMBER, value: num });
        i = j; continue;
      }
    }

    // Identifiers: function names, cell refs, ranges, booleans
    if (/[A-ZÀ-Ü]/i.test(expr[i])) {
      let j = i;
      while (j < expr.length && /[A-ZÀ-Ü0-9.]/i.test(expr[j])) j++;

      // Check for range (A1:B4)
      if (expr[j] === ":") {
        let k = j + 1;
        while (k < expr.length && /[A-Z0-9]/i.test(expr[k])) k++;
        const rangeStr = expr.slice(i, k);
        if (/^[A-Z]\d{1,2}:[A-Z]\d{1,2}$/i.test(rangeStr)) {
          tokens.push({ type: TOKEN.RANGE, value: rangeStr });
          i = k; continue;
        }
      }

      const word = expr.slice(i, j);

      // Boolean
      if (/^(VRAI|TRUE)$/i.test(word)) { tokens.push({ type: TOKEN.BOOL, value: true }); i = j; continue; }
      if (/^(FAUX|FALSE)$/i.test(word)) { tokens.push({ type: TOKEN.BOOL, value: false }); i = j; continue; }

      // Cell reference (A1–Z99)
      if (/^[A-Z]\d{1,2}$/i.test(word) && expr[j] !== "(") {
        tokens.push({ type: TOKEN.CELL, value: word }); i = j; continue;
      }

      // Function name (followed by parenthesis)
      tokens.push({ type: TOKEN.FUNC, value: word.toUpperCase() });
      i = j; continue;
    }

    // Skip unknown
    i++;
  }

  return tokens;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Recursive descent parser + evaluator
// ══════════════════════════════════════════════════════════════════════════════

function evaluate(tokens, grid) {
  let pos = 0;

  const peek = () => tokens[pos];
  const consume = (type) => {
    if (tokens[pos]?.type !== type) throw new Error(`Expected ${type}, got ${tokens[pos]?.type}`);
    return tokens[pos++];
  };

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
      if (op === "&") {
        left = String(left ?? "") + String(right ?? "");
      } else if (op === "+") {
        left = toNumber(left) + toNumber(right);
      } else {
        left = toNumber(left) - toNumber(right);
      }
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

  // ── Atom: number, string, bool, cell, range, function call, (expr) ──
  function parseAtom() {
    const tok = peek();
    if (!tok) throw new Error("Unexpected end");

    if (tok.type === TOKEN.NUMBER) { pos++; return tok.value; }
    if (tok.type === TOKEN.STRING) { pos++; return tok.value; }
    if (tok.type === TOKEN.BOOL) { pos++; return tok.value; }

    if (tok.type === TOKEN.CELL) {
      pos++;
      const raw = resolveCell(tok.value, grid);
      const n = toNumber(raw);
      return isNaN(n) ? raw : n;
    }

    if (tok.type === TOKEN.RANGE) {
      pos++;
      return expandRange(tok.value, grid);
    }

    if (tok.type === TOKEN.LPAREN) {
      pos++; // skip (
      const result = parseExpr();
      consume(TOKEN.RPAREN);
      return result;
    }

    if (tok.type === TOKEN.FUNC) {
      return parseFunction();
    }

    throw new Error(`Unexpected token: ${tok.type}`);
  }

  // ── Parse function call ──
  function parseFunction() {
    const name = tokens[pos++].value;
    consume(TOKEN.LPAREN);

    // Parse arguments
    const args = [];
    if (peek()?.type !== TOKEN.RPAREN) {
      args.push(parseExpr());
      while (peek()?.type === TOKEN.SEP) {
        pos++; // skip separator
        args.push(parseExpr());
      }
    }
    consume(TOKEN.RPAREN);

    return callFunction(name, args);
  }

  // ── Function dispatch ──
  function callFunction(name, args) {
    // Aliases FR → EN
    const fn = name.toUpperCase();

    switch (fn) {
      // ── Math ──────────────────────────────────────────────────────
      case "SOMME":
      case "SUM": {
        const nums = collectNumbers(args, grid);
        return nums.reduce((a, b) => a + b, 0);
      }
      case "MOYENNE":
      case "AVERAGE": {
        const nums = collectNumbers(args, grid);
        return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
      }
      case "MIN": {
        const nums = collectNumbers(args, grid);
        return nums.length ? Math.min(...nums) : 0;
      }
      case "MAX": {
        const nums = collectNumbers(args, grid);
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
      case "SI":
      case "IF": {
        const test = args[0];
        const truthy = (typeof test === "boolean") ? test : Boolean(test);
        return truthy ? args[1] : (args.length > 2 ? args[2] : false);
      }
      case "ET":
      case "AND": {
        for (const a of args) {
          if (Array.isArray(a)) {
            for (const v of a) if (!v) return false;
          } else if (!a) return false;
        }
        return true;
      }
      case "OU":
      case "OR": {
        for (const a of args) {
          if (Array.isArray(a)) {
            for (const v of a) if (v) return true;
          } else if (a) return true;
        }
        return false;
      }
      case "NON":
      case "NOT":
        return !args[0];
      case "SIERREUR":
      case "IFERROR":
        // Dans le contexte local, on retourne toujours le premier argument
        // car on n'a pas de vrai système d'erreur Excel
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
        const start = toNumber(args[1]) - 1; // Excel is 1-indexed
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
          // N-ième occurrence
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
        // Simplifié : retourne le nombre comme string (pas de format Excel complet)
        return String(args[0] ?? "");

      default:
        throw new Error(`Fonction non supportée: ${fn}`);
    }
  }

  const result = parseExpr();

  // S'assurer qu'on a tout consommé
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
 * @returns {string|null} Le résultat formaté, ou null si l'évaluation échoue
 */
export function tryEvaluate(formula, grid) {
  if (!formula || !formula.startsWith("=")) return formula;
  const body = formula.slice(1).trim();
  if (!body) return null;

  try {
    const tokens = tokenize(body);
    const result = evaluate(tokens, grid);

    // Formater le résultat
    if (typeof result === "boolean") return result ? "VRAI" : "FAUX";
    if (typeof result === "number") {
      if (!isFinite(result)) return "#DIV/0!";
      // Arrondir pour éviter les floating point
      return String(Math.round(result * 1e10) / 1e10);
    }
    return String(result);
  } catch {
    return null;
  }
}

/**
 * Liste des fonctions supportées par l'évaluateur local.
 */
export const SUPPORTED_FUNCTIONS = [
  "SOMME", "SUM", "MOYENNE", "AVERAGE", "MIN", "MAX",
  "ABS", "ARRONDI", "ROUND", "TRONQUE", "TRUNC", "ENT", "INT", "MOD", "RACINE", "SQRT", "PUISSANCE", "POWER",
  "SI", "IF", "ET", "AND", "OU", "OR", "NON", "NOT", "SIERREUR", "IFERROR",
  "NB", "COUNT", "NBVAL", "COUNTA", "NB.SI", "COUNTIF",
  "SOMME.SI", "SUMIF", "MOYENNE.SI", "AVERAGEIF",
  "CONCATENER", "CONCATENATE", "CONCAT", "GAUCHE", "LEFT", "DROITE", "RIGHT",
  "STXT", "MID", "MAJUSCULE", "UPPER", "MINUSCULE", "LOWER",
  "NOMPROPRE", "PROPER", "NBCAR", "LEN", "SUPPRESPACE", "TRIM",
  "SUBSTITUE", "SUBSTITUTE", "TEXTE", "TEXT",
];
