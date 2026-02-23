import { useState, useRef } from "react";
import { tryEvaluate, SUPPORTED_FUNCTIONS } from "./evaluator.js";

const GRID_ROWS = 10;
const GRID_COLS = 6;

// ── Backend API URL — à adapter selon l'environnement ──
const API_BASE = import.meta.env?.PUBLIC_API_BASE || "http://localhost:8000";
const colLabel = (i) => String.fromCharCode(65 + i);
const createEmptyGrid = () =>
  Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(""));

// ══════════════════════════════════════════════════════════════════════════════
//  Function catalog with syntax: [name, minArgs, maxArgs, argTypes, description]
//  argTypes: "n"=number, "s"=string, "b"=boolean, "r"=range, "a"=any, "*"=repeatable
// ══════════════════════════════════════════════════════════════════════════════

const FN_CATALOG = {
  // ── Maths ──
  SOMME:              { min: 1, max: 255, args: "n*",     syntax: "SOMME(nombre1; [nombre2]; ...)",             desc: "Additionne des valeurs" },
  SUM:                { min: 1, max: 255, args: "n*",     syntax: "SUM(number1, [number2], ...)",               desc: "Adds values" },
  MOYENNE:            { min: 1, max: 255, args: "n*",     syntax: "MOYENNE(nombre1; [nombre2]; ...)",           desc: "Calcule la moyenne" },
  AVERAGE:            { min: 1, max: 255, args: "n*",     syntax: "AVERAGE(number1, [number2], ...)",           desc: "Calculates the average" },
  MAX:                { min: 1, max: 255, args: "n*",     syntax: "MAX(nombre1; [nombre2]; ...)",               desc: "Retourne la valeur maximale" },
  MIN:                { min: 1, max: 255, args: "n*",     syntax: "MIN(nombre1; [nombre2]; ...)",               desc: "Retourne la valeur minimale" },
  ARRONDI:            { min: 2, max: 2,   args: "nn",     syntax: "ARRONDI(nombre; nb_chiffres)",               desc: "Arrondit un nombre" },
  ROUND:              { min: 2, max: 2,   args: "nn",     syntax: "ROUND(number, num_digits)",                  desc: "Rounds a number" },
  TRONQUE:            { min: 1, max: 2,   args: "nn",     syntax: "TRONQUE(nombre; [nb_chiffres])",             desc: "Tronque un nombre" },
  TRUNC:              { min: 1, max: 2,   args: "nn",     syntax: "TRUNC(number, [num_digits])",                desc: "Truncates a number" },
  ENT:                { min: 1, max: 1,   args: "n",      syntax: "ENT(nombre)",                                desc: "Partie entière" },
  INT:                { min: 1, max: 1,   args: "n",      syntax: "INT(number)",                                desc: "Integer part" },
  MOD:                { min: 2, max: 2,   args: "nn",     syntax: "MOD(nombre; diviseur)",                      desc: "Reste de la division" },
  ABS:                { min: 1, max: 1,   args: "n",      syntax: "ABS(nombre)",                                desc: "Valeur absolue" },
  RACINE:             { min: 1, max: 1,   args: "n",      syntax: "RACINE(nombre)",                             desc: "Racine carrée" },
  SQRT:               { min: 1, max: 1,   args: "n",      syntax: "SQRT(number)",                               desc: "Square root" },
  PUISSANCE:          { min: 2, max: 2,   args: "nn",     syntax: "PUISSANCE(nombre; puissance)",               desc: "Élève à la puissance" },
  POWER:              { min: 2, max: 2,   args: "nn",     syntax: "POWER(number, power)",                       desc: "Raises to a power" },
  ALEA:               { min: 0, max: 0,   args: "",       syntax: "ALEA()",                                     desc: "Nombre aléatoire entre 0 et 1" },
  RAND:               { min: 0, max: 0,   args: "",       syntax: "RAND()",                                     desc: "Random number 0-1" },
  "ALEA.ENTRE.BORNES":{ min: 2, max: 2,  args: "nn",     syntax: "ALEA.ENTRE.BORNES(min; max)",                desc: "Entier aléatoire entre bornes" },
  RANDBETWEEN:        { min: 2, max: 2,   args: "nn",     syntax: "RANDBETWEEN(bottom, top)",                   desc: "Random integer between bounds" },

  // ── Logique ──
  SI:                 { min: 3, max: 3,   args: "baa",    syntax: "SI(test_logique; valeur_si_vrai; valeur_si_faux)", desc: "Condition si/alors/sinon" },
  IF:                 { min: 3, max: 3,   args: "baa",    syntax: "IF(logical_test, value_if_true, value_if_false)",  desc: "If/then/else condition" },
  ET:                 { min: 1, max: 255, args: "b*",     syntax: "ET(logique1; [logique2]; ...)",              desc: "VRAI si toutes les conditions sont vraies" },
  AND:                { min: 1, max: 255, args: "b*",     syntax: "AND(logical1, [logical2], ...)",             desc: "TRUE if all conditions are true" },
  OU:                 { min: 1, max: 255, args: "b*",     syntax: "OU(logique1; [logique2]; ...)",              desc: "VRAI si au moins une condition est vraie" },
  OR:                 { min: 1, max: 255, args: "b*",     syntax: "OR(logical1, [logical2], ...)",              desc: "TRUE if any condition is true" },
  NON:                { min: 1, max: 1,   args: "b",      syntax: "NON(valeur_logique)",                        desc: "Inverse une valeur logique" },
  NOT:                { min: 1, max: 1,   args: "b",      syntax: "NOT(logical)",                               desc: "Inverts a logical value" },
  SIERREUR:           { min: 2, max: 2,   args: "aa",     syntax: "SIERREUR(valeur; valeur_si_erreur)",         desc: "Retourne une valeur si erreur" },
  IFERROR:            { min: 2, max: 2,   args: "aa",     syntax: "IFERROR(value, value_if_error)",             desc: "Returns value if error" },
  IFS:                { min: 2, max: 254, args: "ba*",    syntax: "IFS(test1; valeur1; [test2; valeur2]; ...)", desc: "Conditions multiples" },
  SWITCH:             { min: 3, max: 254, args: "aaa*",   syntax: "SWITCH(expression; val1; res1; ...)",        desc: "Compare une expression à des valeurs" },

  // ── Comptage ──
  NB:                 { min: 1, max: 255, args: "a*",     syntax: "NB(valeur1; [valeur2]; ...)",                desc: "Compte les cellules numériques" },
  COUNT:              { min: 1, max: 255, args: "a*",     syntax: "COUNT(value1, [value2], ...)",               desc: "Counts numeric cells" },
  NBVAL:              { min: 1, max: 255, args: "a*",     syntax: "NBVAL(valeur1; [valeur2]; ...)",             desc: "Compte les cellules non vides" },
  COUNTA:             { min: 1, max: 255, args: "a*",     syntax: "COUNTA(value1, [value2], ...)",              desc: "Counts non-empty cells" },
  "NB.VIDE":          { min: 1, max: 1,   args: "r",      syntax: "NB.VIDE(plage)",                             desc: "Compte les cellules vides" },
  COUNTBLANK:         { min: 1, max: 1,   args: "r",      syntax: "COUNTBLANK(range)",                          desc: "Counts blank cells" },
  "NB.SI":            { min: 2, max: 2,   args: "rs",     syntax: "NB.SI(plage; critère)",                      desc: "Compte selon un critère" },
  COUNTIF:            { min: 2, max: 2,   args: "rs",     syntax: "COUNTIF(range, criteria)",                   desc: "Counts by criteria" },
  "NB.SI.ENS":        { min: 2, max: 254, args: "rs*",    syntax: "NB.SI.ENS(plage1; critère1; ...)",           desc: "Compte selon plusieurs critères" },
  COUNTIFS:           { min: 2, max: 254, args: "rs*",    syntax: "COUNTIFS(range1, criteria1, ...)",            desc: "Counts by multiple criteria" },

  // ── Somme conditionnelle ──
  "SOMME.SI":         { min: 2, max: 3,   args: "rsr",    syntax: "SOMME.SI(plage; critère; [somme_plage])",    desc: "Somme conditionnelle" },
  SUMIF:              { min: 2, max: 3,   args: "rsr",    syntax: "SUMIF(range, criteria, [sum_range])",        desc: "Conditional sum" },
  "SOMME.SI.ENS":     { min: 3, max: 254, args: "rrs*",   syntax: "SOMME.SI.ENS(somme_plage; plage1; critère1; ...)", desc: "Somme multi-critères" },
  SUMIFS:             { min: 3, max: 254, args: "rrs*",   syntax: "SUMIFS(sum_range, range1, criteria1, ...)",  desc: "Multi-criteria sum" },
  "MOYENNE.SI":       { min: 2, max: 3,   args: "rsr",    syntax: "MOYENNE.SI(plage; critère; [moy_plage])",    desc: "Moyenne conditionnelle" },
  AVERAGEIF:          { min: 2, max: 3,   args: "rsr",    syntax: "AVERAGEIF(range, criteria, [avg_range])",    desc: "Conditional average" },
  "MOYENNE.SI.ENS":   { min: 3, max: 254, args: "rrs*",   syntax: "MOYENNE.SI.ENS(moy_plage; plage1; critère1; ...)", desc: "Moyenne multi-critères" },
  AVERAGEIFS:         { min: 3, max: 254, args: "rrs*",   syntax: "AVERAGEIFS(avg_range, range1, criteria1, ...)", desc: "Multi-criteria average" },

  // ── Recherche ──
  RECHERCHEV:         { min: 3, max: 4,   args: "rrnb",   syntax: "RECHERCHEV(valeur; table; col; [approx])",   desc: "Recherche verticale" },
  VLOOKUP:            { min: 3, max: 4,   args: "rrnb",   syntax: "VLOOKUP(value, table, col, [approx])",       desc: "Vertical lookup" },
  RECHERCHEH:         { min: 3, max: 4,   args: "rrnb",   syntax: "RECHERCHEH(valeur; table; ligne; [approx])", desc: "Recherche horizontale" },
  HLOOKUP:            { min: 3, max: 4,   args: "rrnb",   syntax: "HLOOKUP(value, table, row, [approx])",       desc: "Horizontal lookup" },
  RECHERCHEX:         { min: 3, max: 6,   args: "rrraan", syntax: "RECHERCHEX(cherché; plage_recherche; plage_résultat; [défaut]; [mode]; [recherche])", desc: "Recherche moderne (XLOOKUP)" },
  XLOOKUP:            { min: 3, max: 6,   args: "rrraan", syntax: "XLOOKUP(lookup, lookup_range, return_range, [default], [match], [search])", desc: "Modern lookup" },
  INDEX:              { min: 2, max: 3,   args: "rnn",    syntax: "INDEX(tableau; ligne; [colonne])",            desc: "Valeur à une position" },
  EQUIV:              { min: 2, max: 3,   args: "arn",    syntax: "EQUIV(valeur; plage; [type])",                desc: "Position d'une valeur" },

  // ── Texte ──
  GAUCHE:             { min: 1, max: 2,   args: "sn",     syntax: "GAUCHE(texte; [nb_car])",                    desc: "Premiers caractères" },
  LEFT:               { min: 1, max: 2,   args: "sn",     syntax: "LEFT(text, [num_chars])",                    desc: "First characters" },
  DROITE:             { min: 1, max: 2,   args: "sn",     syntax: "DROITE(texte; [nb_car])",                    desc: "Derniers caractères" },
  RIGHT:              { min: 1, max: 2,   args: "sn",     syntax: "RIGHT(text, [num_chars])",                   desc: "Last characters" },
  STXT:               { min: 3, max: 3,   args: "snn",    syntax: "STXT(texte; position; nb_car)",              desc: "Extrait du texte" },
  MID:                { min: 3, max: 3,   args: "snn",    syntax: "MID(text, start, num_chars)",                desc: "Extracts text" },
  NBCAR:              { min: 1, max: 1,   args: "s",      syntax: "NBCAR(texte)",                               desc: "Nombre de caractères" },
  LEN:                { min: 1, max: 1,   args: "s",      syntax: "LEN(text)",                                  desc: "Number of characters" },
  MAJUSCULE:          { min: 1, max: 1,   args: "s",      syntax: "MAJUSCULE(texte)",                           desc: "Convertit en majuscules" },
  UPPER:              { min: 1, max: 1,   args: "s",      syntax: "UPPER(text)",                                desc: "Converts to uppercase" },
  MINUSCULE:          { min: 1, max: 1,   args: "s",      syntax: "MINUSCULE(texte)",                           desc: "Convertit en minuscules" },
  LOWER:              { min: 1, max: 1,   args: "s",      syntax: "LOWER(text)",                                desc: "Converts to lowercase" },
  NOMPROPRE:          { min: 1, max: 1,   args: "s",      syntax: "NOMPROPRE(texte)",                           desc: "Première lettre en majuscule" },
  PROPER:             { min: 1, max: 1,   args: "s",      syntax: "PROPER(text)",                               desc: "Capitalizes first letter" },
  CONCATENER:         { min: 1, max: 255, args: "s*",     syntax: "CONCATENER(texte1; [texte2]; ...)",          desc: "Concatène du texte" },
  CONCAT:             { min: 1, max: 255, args: "s*",     syntax: "CONCAT(texte1; [texte2]; ...)",              desc: "Concatène du texte (version courte)" },
  CONCATENATE:        { min: 1, max: 255, args: "s*",     syntax: "CONCATENATE(text1, [text2], ...)",           desc: "Concatenates text" },
  TEXTE:              { min: 2, max: 2,   args: "ns",     syntax: "TEXTE(valeur; format)",                      desc: "Formate un nombre en texte" },
  TEXT:                { min: 2, max: 2,   args: "ns",     syntax: "TEXT(value, format_text)",                    desc: "Formats number as text" },
  SUBSTITUE:          { min: 3, max: 4,   args: "sssn",   syntax: "SUBSTITUE(texte; ancien; nouveau; [occurrence])", desc: "Remplace du texte" },
  SUBSTITUTE:         { min: 3, max: 4,   args: "sssn",   syntax: "SUBSTITUTE(text, old, new, [instance])",     desc: "Replaces text" },
  SUPPRESPACE:        { min: 1, max: 1,   args: "s",      syntax: "SUPPRESPACE(texte)",                         desc: "Supprime les espaces superflus" },
  TRIM:               { min: 1, max: 1,   args: "s",      syntax: "TRIM(text)",                                 desc: "Removes extra spaces" },

  // ── Date ──
  AUJOURDHUI:         { min: 0, max: 0,   args: "",       syntax: "AUJOURDHUI()",                               desc: "Date du jour" },
  TODAY:              { min: 0, max: 0,   args: "",       syntax: "TODAY()",                                    desc: "Today's date" },
  MAINTENANT:         { min: 0, max: 0,   args: "",       syntax: "MAINTENANT()",                               desc: "Date et heure actuelles" },
  NOW:                { min: 0, max: 0,   args: "",       syntax: "NOW()",                                      desc: "Current date and time" },
  ANNEE:              { min: 1, max: 1,   args: "n",      syntax: "ANNEE(date)",                                desc: "Extrait l'année" },
  YEAR:               { min: 1, max: 1,   args: "n",      syntax: "YEAR(date)",                                 desc: "Extracts year" },
  MOIS:               { min: 1, max: 1,   args: "n",      syntax: "MOIS(date)",                                 desc: "Extrait le mois" },
  MONTH:              { min: 1, max: 1,   args: "n",      syntax: "MONTH(date)",                                desc: "Extracts month" },
  JOUR:               { min: 1, max: 1,   args: "n",      syntax: "JOUR(date)",                                 desc: "Extrait le jour" },
  DAY:                { min: 1, max: 1,   args: "n",      syntax: "DAY(date)",                                  desc: "Extracts day" },
  DATE:               { min: 3, max: 3,   args: "nnn",    syntax: "DATE(année; mois; jour)",                    desc: "Crée une date" },
  JOURSEM:            { min: 1, max: 2,   args: "nn",     syntax: "JOURSEM(date; [type])",                      desc: "Jour de la semaine" },
  WEEKDAY:            { min: 1, max: 2,   args: "nn",     syntax: "WEEKDAY(date, [type])",                      desc: "Day of the week" },
  "FIN.MOIS":         { min: 2, max: 2,   args: "nn",     syntax: "FIN.MOIS(date_départ; mois)",                desc: "Dernier jour du mois" },
  EOMONTH:            { min: 2, max: 2,   args: "nn",     syntax: "EOMONTH(start_date, months)",                desc: "End of month" },

  // ── Stats ──
  RANG:               { min: 2, max: 3,   args: "nrn",    syntax: "RANG(nombre; réf; [ordre])",                 desc: "Rang d'une valeur" },
  RANK:               { min: 2, max: 3,   args: "nrn",    syntax: "RANK(number, ref, [order])",                 desc: "Rank of a value" },
  "GRANDE.VALEUR":    { min: 2, max: 2,   args: "rn",     syntax: "GRANDE.VALEUR(plage; k)",                    desc: "K-ième plus grande valeur" },
  LARGE:              { min: 2, max: 2,   args: "rn",     syntax: "LARGE(array, k)",                            desc: "K-th largest value" },
  "PETITE.VALEUR":    { min: 2, max: 2,   args: "rn",     syntax: "PETITE.VALEUR(plage; k)",                    desc: "K-ième plus petite valeur" },
  SMALL:              { min: 2, max: 2,   args: "rn",     syntax: "SMALL(array, k)",                            desc: "K-th smallest value" },
};

const EXCEL_FUNCTIONS = Object.keys(FN_CATALOG);

// ══════════════════════════════════════════════════════════════════════════════
//  Parse function calls and their arguments from a formula body
// ══════════════════════════════════════════════════════════════════════════════

function parseFunctionCalls(body) {
  const calls = [];
  const fnPattern = /([A-ZÀ-Ü][A-ZÀ-Ü0-9.]*)\s*\(/gi;
  let match;

  while ((match = fnPattern.exec(body)) !== null) {
    const fnName = match[1];
    const openIdx = match.index + match[0].length - 1; // position of '('
    // Find matching close paren
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
      // Split by separator (;,) at depth 0 only
      const args = [];
      let argStart = 0, d = 0, s = false;
      for (let j = 0; j <= argsStr.length; j++) {
        if (j < argsStr.length && argsStr[j] === '"') s = !s;
        if (!s && j < argsStr.length) {
          if (argsStr[j] === '(') d++;
          if (argsStr[j] === ')') d--;
        }
        if ((j === argsStr.length || (!s && d === 0 && (argsStr[j] === ';' || argsStr[j] === ','))) ) {
          const arg = argsStr.slice(argStart, j).trim();
          if (arg || args.length > 0 || j < argsStr.length) args.push(arg);
          argStart = j + 1;
        }
      }
      // Filter: if only one empty arg, it means no args
      const realArgs = (args.length === 1 && args[0] === "") ? [] : args;
      calls.push({ name: fnName, args: realArgs, raw: argsStr.trim() });
    }
  }
  return calls;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Lint: typo + syntax validation
// ══════════════════════════════════════════════════════════════════════════════

function lintFormula(formula) {
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

  // Double separators
  if (/;;/.test(body)) warnings.push({ type: "warning", msg: "Double point-virgule (;;)" });
  if (/,,/.test(body)) warnings.push({ type: "warning", msg: "Double virgule (,,)" });
  if (/[;,]\s*\)/.test(body))
    warnings.push({ type: "warning", msg: "Séparateur avant ) — argument manquant ?" });
  if (/\)\(/.test(body))
    warnings.push({ type: "warning", msg: "Parenthèses adjacentes )( — opérateur manquant ?" });

  // Unmatched quotes
  const qc = (body.match(/"/g) || []).length;
  if (qc % 2 !== 0) warnings.push({ type: "error", msg: "Guillemet non fermé" });

  // ── Function-level validation ──
  const fnCalls = parseFunctionCalls(body);
  for (const call of fnCalls) {
    const fn = FN_CATALOG[call.name.toUpperCase()];
    if (!fn) {
      // Check if it looks similar to a known function (typo?)
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

    // Argument count
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

    // Argument type hints (best-effort on literal values)
    if (fn.args && argc > 0 && argc >= fn.min) {
      const types = fn.args.replace("*", "");
      for (let i = 0; i < Math.min(argc, types.length); i++) {
        const expected = types[i];
        const arg = call.args[i];
        if (!arg) continue;

        // Skip cell references, ranges, nested functions — we can't type-check those
        if (/^[A-Z]+\d+/i.test(arg) || /[:(]/.test(arg)) continue;

        const isQuoted = /^".*"$/.test(arg);
        const isNumber = /^-?\d+([.,]\d+)?$/.test(arg);
        const isBool = /^(VRAI|FAUX|TRUE|FALSE)$/i.test(arg);

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
//  Syntax-highlighted formula
// ══════════════════════════════════════════════════════════════════════════════

function FormulaHighlight({ formula }) {
  if (!formula) return null;
  const tokens = [];
  let i = 0;
  const s = formula;
  while (i < s.length) {
    if (i === 0 && s[i] === "=") {
      tokens.push(<span key={i} style={{ color: "#7dd3fc" }}>=</span>); i++;
    } else if (s[i] === '"') {
      let j = i + 1; while (j < s.length && s[j] !== '"') j++;
      tokens.push(<span key={i} style={{ color: "#fbbf24" }}>{s.slice(i, j + 1)}</span>); i = j + 1;
    } else if (/[A-ZÀ-Ü]/i.test(s[i])) {
      let j = i; while (j < s.length && /[A-ZÀ-Ü0-9.]/i.test(s[j])) j++;
      const w = s.slice(i, j);
      if (FN_CATALOG[w.toUpperCase()])
        tokens.push(<span key={i} style={{ color: "#a78bfa", fontWeight: 600 }}>{w}</span>);
      else if (/^[A-Z]\d{1,2}$/i.test(w))
        tokens.push(<span key={i} style={{ color: "#34d399" }}>{w}</span>);
      else tokens.push(<span key={i} style={{ color: "#e2e8f0" }}>{w}</span>);
      i = j;
    } else if (/[0-9]/.test(s[i])) {
      let j = i; while (j < s.length && /[0-9.,]/.test(s[j])) j++;
      tokens.push(<span key={i} style={{ color: "#38bdf8" }}>{s.slice(i, j)}</span>); i = j;
    } else if ("()".includes(s[i])) {
      tokens.push(<span key={i} style={{ color: "#f472b6" }}>{s[i]}</span>); i++;
    } else if ("+-*/<>=!&".includes(s[i])) {
      tokens.push(<span key={i} style={{ color: "#fb923c" }}>{s[i]}</span>); i++;
    } else if (";,".includes(s[i])) {
      tokens.push(<span key={i} style={{ color: "#94a3b8" }}>{s[i]}</span>); i++;
    } else {
      tokens.push(<span key={i} style={{ color: "#e2e8f0" }}>{s[i]}</span>); i++;
    }
  }
  return <div style={{ fontFamily: "var(--mono)", fontSize: 14, whiteSpace: "pre" }}>{tokens}</div>;
}

function SeverityIcon({ type }) {
  const colors = { error: "#ef4444", warning: "#f59e0b", info: "#60a5fa" };
  return <span style={{ color: colors[type], marginRight: 8, fontSize: 16 }}>●</span>;
}

// ══════════════════════════════════════════════════════════════════════════════
//  Main App
// ══════════════════════════════════════════════════════════════════════════════

export default function ExcelFormulaTester() {
  const [formula, setFormula] = useState('=SI(A1>10;"Grand";"Petit")');
  const [grid, setGrid] = useState(() => {
    const g = createEmptyGrid();
    g[0][0]="15"; g[1][0]="8"; g[2][0]="22"; g[3][0]="5";
    g[0][1]="100"; g[1][1]="200"; g[2][1]="150"; g[3][1]="175";
    return g;
  });
  const [selectedCell, setSelectedCell] = useState(null);
  const [intention, setIntention] = useState("");
  const [explanation, setExplanation] = useState(null);
  const [details, setDetails] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);
  const [activeTab, setActiveTab] = useState("lint");
  const [hoveredFn, setHoveredFn] = useState(null);
  const inputRef = useRef(null);
  const fileRef = useRef(null);
  const formulaFocused = useRef(false);
  const cursorPos = useRef(0);

  const warnings = lintFormula(formula);
  const evalResult = tryEvaluate(formula, grid);

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

  // ── Cell click: insert ref if formula was focused, else edit cell ──
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

  // ── Build API payload ──
  const buildPayload = () => {
    const gridCtx = grid.slice(0, 5)
      .map((row, ri) => row.slice(0, 4).map((v, ci) => `${colLabel(ci)}${ri+1}=${v||"(vide)"}`).join(", "))
      .join("\n");
    return {
      formula,
      grid_context: gridCtx,
      warnings: warnings.map(w => w.msg),
      eval_result: evalResult,
      intention,
    };
  };

  // ── Analyse rapide (résumé + intention + améliorations) ──
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
      setExplanation(data.explanation);
    } catch (err) {
      setExplanation(`❌ Erreur : ${err.message}\n\nVérifiez que le serveur backend est lancé sur ${API_BASE}`);
    } finally {
      setIsAnalyzing(false);
    }
  };

  // ── Décomposition détaillée (bouton "Plus de détails") ──
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
      setDetails(`❌ Erreur : ${err.message}`);
    } finally {
      setIsLoadingDetails(false);
    }
  };

  // ── Styles ──
  const mono = "'JetBrains Mono', 'Fira Code', monospace";
  const sans = "'DM Sans', 'Segoe UI', system-ui, sans-serif";

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(145deg, #080e14 0%, #0c1520 50%, #0a1018 100%)",
      color: "#e2e8f0", fontFamily: sans, padding: "24px 20px",
      "--mono": `${mono}`,
    }}>
      <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />

      {/* Header */}
      <div style={{ maxWidth: 980, margin: "0 auto 24px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{
            width: 38, height: 38, borderRadius: 10,
            background: "linear-gradient(135deg, #10b981, #059669)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 18, fontWeight: 700, color: "#fff",
            boxShadow: "0 0 20px #10b98133", fontFamily: mono,
          }}>fx</div>
          <div>
            <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: "-0.02em", color: "#f1f5f9" }}>
              Testeur de formules Excel
            </h1>
            <p style={{ margin: 0, fontSize: 12, color: "#64748b", fontWeight: 500 }}>
              Écrivez, testez et analysez vos formules en temps réel
            </p>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 980, margin: "0 auto" }}>
        {/* Formula Bar */}
        <div style={{
          background: "#111b27", border: "1px solid #1e3048", borderRadius: 14,
          padding: 20, marginBottom: 20, boxShadow: "0 4px 24px #0005",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 14 }}>
            <div style={{
              background: "#10b98122", color: "#10b981", padding: "4px 12px",
              borderRadius: 6, fontSize: 13, fontWeight: 600, fontFamily: mono,
            }}>fx</div>
            <input
              ref={inputRef}
              type="text"
              value={formula}
              onChange={(e) => { setFormula(e.target.value); cursorPos.current = e.target.selectionStart; setExplanation(null); setDetails(null); }}
              onKeyUp={handleFormulaSelect}
              onClick={handleFormulaSelect}
              placeholder="=SOMME(A1:A4)"
              style={{
                flex: 1, background: "#0a1018", border: "1px solid #1e3048",
                borderRadius: 8, padding: "10px 14px", color: "#e2e8f0",
                fontSize: 15, fontFamily: mono, outline: "none", transition: "border-color 0.2s",
              }}
              onFocus={(e) => { e.target.style.borderColor = "#10b981"; formulaFocused.current = true; }}
              onBlur={(e) => { e.target.style.borderColor = "#1e3048"; setTimeout(() => { formulaFocused.current = false; setHoveredFn(null); }, 200); }}
            />
            <button
              onClick={analyzeFormula}
              disabled={isAnalyzing || !formula}
              style={{
                background: isAnalyzing ? "#1e3048" : "linear-gradient(135deg, #10b981, #059669)",
                color: "#fff", border: "none", borderRadius: 8, padding: "10px 20px",
                fontSize: 13, fontWeight: 600, cursor: isAnalyzing ? "wait" : "pointer",
                whiteSpace: "nowrap", boxShadow: isAnalyzing ? "none" : "0 2px 12px #10b98133",
              }}
            >{isAnalyzing ? "Analyse…" : "Analyser IA"}</button>
          </div>

          {/* Syntax tooltip */}
          {hoveredFn && (
            <div style={{
              background: "#1a2744", border: "1px solid #2d4a6f", borderRadius: 8,
              padding: "8px 12px", marginBottom: 10, fontSize: 12, lineHeight: 1.6,
            }}>
              <span style={{ color: "#a78bfa", fontWeight: 600, fontFamily: mono }}>{hoveredFn.syntax}</span>
              <span style={{ color: "#64748b", marginLeft: 12 }}>{hoveredFn.desc}</span>
              <span style={{ color: "#475569", marginLeft: 12 }}>
                ({hoveredFn.min === hoveredFn.max ? `${hoveredFn.min} arg` : `${hoveredFn.min}–${hoveredFn.max} args`})
              </span>
            </div>
          )}

          {/* Syntax highlight */}
          <div style={{
            background: "#0a1018", borderRadius: 8, padding: "8px 14px",
            minHeight: 24, border: "1px solid #1e304844",
          }}>
            <FormulaHighlight formula={formula} />
          </div>

          {/* Intention field */}
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 11, color: "#64748b", fontWeight: 600, marginBottom: 4 }}>
              💡 Que voulez-vous accomplir ? <span style={{ fontWeight: 400 }}>(optionnel — aide l'IA à valider votre formule)</span>
            </div>
            <input
              type="text"
              value={intention}
              onChange={(e) => setIntention(e.target.value)}
              placeholder='Ex: « Additionner les ventes supérieures à 100$ » ou « Trouver le nom de l'employé avec l'ID en A1 »'
              style={{
                width: "100%", boxSizing: "border-box",
                background: "#0a1018", border: "1px solid #1e304844",
                borderRadius: 8, padding: "8px 12px", color: "#cbd5e1",
                fontSize: 13, fontFamily: sans, outline: "none",
                transition: "border-color 0.2s",
              }}
              onFocus={(e) => e.target.style.borderColor = "#60a5fa55"}
              onBlur={(e) => e.target.style.borderColor = "#1e304844"}
            />
          </div>

          {/* Result */}
          {formula.startsWith("=") && (() => {
            const unsupported = formula.slice(1).match(/([A-ZÀ-Ü][A-ZÀ-Ü0-9.]*)\s*\(/gi)
              ?.map(m => m.replace(/\s*\($/, "").toUpperCase())
              .filter(fn => !SUPPORTED_FUNCTIONS.includes(fn));
            return (
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 12 }}>
                <span style={{ fontSize: 12, color: "#64748b", fontWeight: 500 }}>Résultat :</span>
                <span style={{
                  fontFamily: mono, fontSize: 14, fontWeight: 600,
                  color: evalResult !== null ? "#34d399" : "#f59e0b",
                  background: evalResult !== null ? "#10b98115" : "#f59e0b15",
                  padding: "3px 12px", borderRadius: 6,
                }}>{evalResult !== null ? evalResult
                  : unsupported?.length
                    ? `${unsupported.join(", ")} non supporté localement`
                    : "Évaluation locale non disponible"
                }</span>
              </div>
            );
          })()}
        </div>

        {/* Grid + Analysis */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
          {/* Cell Grid */}
          <div style={{
            background: "#111b27", border: "1px solid #1e3048", borderRadius: 14,
            padding: 16, boxShadow: "0 4px 24px #0005", overflow: "auto",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b" }}>Grille de données</div>
              <div style={{ display: "flex", gap: 8 }}>
                <input ref={fileRef} type="file" accept=".csv,.tsv,.txt" onChange={handleCSV} style={{ display: "none" }} />
                <button
                  onClick={() => fileRef.current?.click()}
                  style={{
                    background: "#0a1018", border: "1px solid #1e3048", borderRadius: 6,
                    padding: "4px 10px", color: "#94a3b8", fontSize: 11, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                  onMouseOver={(e) => { e.target.style.borderColor="#10b981"; e.target.style.color="#10b981"; }}
                  onMouseOut={(e) => { e.target.style.borderColor="#1e3048"; e.target.style.color="#94a3b8"; }}
                >Charger CSV</button>
                <button
                  onClick={() => setGrid(createEmptyGrid())}
                  style={{
                    background: "#0a1018", border: "1px solid #1e3048", borderRadius: 6,
                    padding: "4px 10px", color: "#94a3b8", fontSize: 11, fontWeight: 600,
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                  onMouseOver={(e) => { e.target.style.borderColor="#ef4444"; e.target.style.color="#ef4444"; }}
                  onMouseOut={(e) => { e.target.style.borderColor="#1e3048"; e.target.style.color="#94a3b8"; }}
                >Effacer</button>
              </div>
            </div>

            <table
              onMouseDown={(e) => {
                // Empêche le blur de l'input formule quand on clique pour insérer une ref
                if (formulaFocused.current) e.preventDefault();
              }}
              style={{ borderCollapse: "collapse", width: "100%", tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{ width: 32, padding: "6px 4px", fontSize: 10, color: "#475569", fontWeight: 600, textAlign: "center", borderBottom: "1px solid #1e3048" }}></th>
                  {Array.from({ length: GRID_COLS }, (_, c) => (
                    <th key={c} style={{ padding: "6px 4px", fontSize: 11, color: "#10b981", fontWeight: 600, textAlign: "center", borderBottom: "1px solid #1e3048", fontFamily: mono }}>{colLabel(c)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: GRID_ROWS }, (_, r) => (
                  <tr key={r}>
                    <td style={{ padding: "4px 6px", fontSize: 11, color: "#10b981", fontWeight: 600, textAlign: "center", fontFamily: mono, borderRight: "1px solid #1e304844" }}>{r + 1}</td>
                    {Array.from({ length: GRID_COLS }, (_, c) => {
                      const isSelected = selectedCell?.r === r && selectedCell?.c === c;
                      return (
                        <td
                          key={c}
                          onClick={() => handleCellClick(r, c)}
                          style={{
                            padding: 0,
                            background: isSelected ? "#1e3a5f" : r % 2 === 0 ? "#0f1923" : "#111d2a",
                            border: isSelected ? "1.5px solid #10b981" : "1px solid #1e304844",
                            cursor: "cell",
                          }}
                        >
                          {isSelected ? (
                            <input
                              autoFocus
                              value={grid[r][c]}
                              onChange={(e) => updateCell(r, c, e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  // Move down
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
                              style={{
                                width: "100%", boxSizing: "border-box", background: "transparent",
                                border: "none", color: "#e2e8f0", fontSize: 12, fontFamily: mono,
                                padding: "5px 6px", outline: "none",
                              }}
                            />
                          ) : (
                            <div style={{
                              fontSize: 12, fontFamily: mono, padding: "5px 6px", minHeight: 24,
                              color: grid[r][c] ? "#e2e8f0" : "#334155",
                              overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            }}>{grid[r][c]}</div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <div style={{ marginTop: 10, fontSize: 11, color: "#475569" }}>
              Cliquez pour éditer • Enter ↓ Tab → • Cliquez pendant l'édition de la formule pour insérer une référence
            </div>
          </div>

          {/* Analysis Panel */}
          <div style={{
            background: "#111b27", border: "1px solid #1e3048", borderRadius: 14,
            boxShadow: "0 4px 24px #0005", display: "flex", flexDirection: "column", overflow: "hidden",
          }}>
            <div style={{ display: "flex", borderBottom: "1px solid #1e3048" }}>
              {[
                { id: "lint", label: "Diagnostic", count: warnings.length },
                { id: "explain", label: "Analyse IA" },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  style={{
                    flex: 1, padding: "12px 16px",
                    background: activeTab === tab.id ? "#0a1018" : "transparent",
                    border: "none",
                    borderBottom: activeTab === tab.id ? "2px solid #10b981" : "2px solid transparent",
                    color: activeTab === tab.id ? "#e2e8f0" : "#64748b",
                    fontSize: 13, fontWeight: 600, cursor: "pointer",
                    display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  }}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span style={{
                      background: "#ef444433", color: "#ef4444", fontSize: 11, fontWeight: 700,
                      padding: "1px 7px", borderRadius: 10,
                    }}>{tab.count}</span>
                  )}
                </button>
              ))}
            </div>

            <div style={{ flex: 1, padding: 16, overflow: "auto", minHeight: 300 }}>
              {activeTab === "lint" && (
                <div>
                  {warnings.length === 0 ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", color: "#64748b" }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#10b98115", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, marginBottom: 12 }}>✓</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#34d399" }}>Aucun problème détecté</div>
                      <div style={{ fontSize: 12, marginTop: 4 }}>La syntaxe de votre formule semble correcte</div>
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      {warnings.map((w, i) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "flex-start", padding: "10px 12px", borderRadius: 8,
                          background: w.type === "error" ? "#ef444410" : w.type === "warning" ? "#f59e0b10" : "#60a5fa10",
                          border: `1px solid ${w.type === "error" ? "#ef444425" : w.type === "warning" ? "#f59e0b25" : "#60a5fa25"}`,
                        }}>
                          <SeverityIcon type={w.type} />
                          <div>
                            <div style={{
                              fontSize: 12, fontWeight: 600, textTransform: "uppercase", marginBottom: 2,
                              color: w.type === "error" ? "#ef4444" : w.type === "warning" ? "#f59e0b" : "#60a5fa",
                            }}>{w.type === "error" ? "Erreur" : w.type === "warning" ? "Avertissement" : "Info"}</div>
                            <div style={{ fontSize: 13, color: "#cbd5e1", lineHeight: 1.5, whiteSpace: "pre-line" }}>{w.msg}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Legend */}
                  <div style={{ marginTop: 20, padding: 14, background: "#0a1018", borderRadius: 10, border: "1px solid #1e304844" }}>
                    <div style={{ fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 8 }}>Coloration syntaxique</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 16px", fontSize: 12 }}>
                      {[
                        { color: "#a78bfa", label: "Fonctions" }, { color: "#34d399", label: "Cellules" },
                        { color: "#38bdf8", label: "Nombres" }, { color: "#fbbf24", label: "Texte" },
                        { color: "#fb923c", label: "Opérateurs" }, { color: "#f472b6", label: "Parenthèses" },
                      ].map((item) => (
                        <div key={item.label} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span style={{ width: 10, height: 10, borderRadius: 3, background: item.color, display: "inline-block" }} />
                          <span style={{ color: "#94a3b8" }}>{item.label}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "explain" && (
                <div>
                  {isAnalyzing ? (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
                      <div style={{ width: 40, height: 40, border: "3px solid #1e3048", borderTopColor: "#10b981", borderRadius: "50%", animation: "spin 0.8s linear infinite", marginBottom: 16 }} />
                      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
                      <div style={{ fontSize: 14, fontWeight: 500, color: "#64748b" }}>Analyse en cours…</div>
                    </div>
                  ) : explanation ? (
                    <div>
                      {/* Analyse rapide */}
                      <div style={{ fontSize: 13, lineHeight: 1.7, color: "#cbd5e1", whiteSpace: "pre-wrap" }}>
                        {explanation.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                          part.startsWith("**") && part.endsWith("**")
                            ? <strong key={i} style={{ color: "#10b981", fontWeight: 600 }}>{part.slice(2, -2)}</strong>
                            : <span key={i}>{part}</span>
                        )}
                      </div>

                      {/* Bouton Plus de détails */}
                      {!details && !isLoadingDetails && (
                        <button
                          onClick={analyzeDetails}
                          style={{
                            marginTop: 16, width: "100%",
                            background: "transparent", border: "1px dashed #1e3048",
                            borderRadius: 8, padding: "10px 16px",
                            color: "#94a3b8", fontSize: 13, fontWeight: 500,
                            cursor: "pointer", transition: "all 0.2s",
                            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                          }}
                          onMouseOver={(e) => { e.currentTarget.style.borderColor="#10b981"; e.currentTarget.style.color="#10b981"; }}
                          onMouseOut={(e) => { e.currentTarget.style.borderColor="#1e3048"; e.currentTarget.style.color="#94a3b8"; }}
                        >
                          <span style={{ fontSize: 16 }}>🔍</span> Plus de détails — décomposition étape par étape
                        </button>
                      )}

                      {/* Loading details */}
                      {isLoadingDetails && (
                        <div style={{
                          marginTop: 16, padding: "16px", borderRadius: 8,
                          border: "1px solid #1e304844", background: "#0a1018",
                          display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                        }}>
                          <div style={{
                            width: 20, height: 20, border: "2px solid #1e3048",
                            borderTopColor: "#a78bfa", borderRadius: "50%",
                            animation: "spin 0.8s linear infinite",
                          }} />
                          <span style={{ fontSize: 13, color: "#64748b" }}>Décomposition en cours…</span>
                        </div>
                      )}

                      {/* Décomposition détaillée */}
                      {details && (
                        <div style={{
                          marginTop: 16, padding: "14px", borderRadius: 10,
                          border: "1px solid #a78bfa25", background: "#a78bfa08",
                        }}>
                          <div style={{
                            fontSize: 12, fontWeight: 600, color: "#a78bfa",
                            marginBottom: 10, display: "flex", alignItems: "center", gap: 6,
                          }}>
                            <span>🔍</span> Décomposition détaillée
                          </div>
                          <div style={{ fontSize: 13, lineHeight: 1.7, color: "#cbd5e1", whiteSpace: "pre-wrap" }}>
                            {details.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                              part.startsWith("**") && part.endsWith("**")
                                ? <strong key={i} style={{ color: "#a78bfa", fontWeight: 600 }}>{part.slice(2, -2)}</strong>
                                : <span key={i}>{part}</span>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", color: "#64748b", textAlign: "center" }}>
                      <div style={{ width: 48, height: 48, borderRadius: "50%", background: "#60a5fa15", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22, marginBottom: 12 }}>🤖</div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "#94a3b8" }}>Analyse IA</div>
                      <div style={{ fontSize: 12, marginTop: 4, maxWidth: 260, lineHeight: 1.5 }}>
                        Cliquez sur « Analyser IA » pour obtenir une explication détaillée
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Examples */}
        <div style={{
          marginTop: 20, background: "#111b27", border: "1px solid #1e3048",
          borderRadius: 14, padding: 16, boxShadow: "0 4px 24px #0005",
        }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "#64748b", marginBottom: 10 }}>
            Exemples de formules à tester
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {[
              '=SOMME(A1;A2;A3;A4)',
              '=SI(A1>10;"Grand";"Petit")',
              '=MOYENNE(B1;B2;B3;B4)',
              '=NB.SI(A1:A4;">10")',
              '=SI(ET(A1>5;B1>100);"OK";"Non")',
              '=RECHERCHEV(A1;A1:B4;2;0)',
              '=CONCATENER(A1;" - ";B1)',
              '=ARRONDI(MOYENNE(B1;B2);2)',
              '=SOMME.SI(A1:A4;">10";B1:B4)',
            ].map((ex) => (
              <button
                key={ex}
                onClick={() => { setFormula(ex); setExplanation(null); setDetails(null); }}
                style={{
                  background: "#0a1018", border: "1px solid #1e3048", borderRadius: 8,
                  padding: "6px 12px", color: "#94a3b8", fontSize: 12, fontFamily: mono,
                  cursor: "pointer", transition: "all 0.2s",
                }}
                onMouseOver={(e) => { e.target.style.borderColor="#10b981"; e.target.style.color="#10b981"; }}
                onMouseOut={(e) => { e.target.style.borderColor="#1e3048"; e.target.style.color="#94a3b8"; }}
              >{ex}</button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
