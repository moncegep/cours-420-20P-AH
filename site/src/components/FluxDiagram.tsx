/**
 * FluxDiagram.tsx
 * Diagramme de flux entièrement en SVG — compatible Astro Starlight (dark/light).
 *
 * Usage dans MDX :
 *   import FluxDiagram from '@components/FluxDiagram';
 *   <FluxDiagram titre="Mon flux" steps={[...]} client:load />
 */

import { useState, useEffect } from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type FluxNote = {
  type: "tip" | "warn";
  text: string;
};

export type FluxStep = {
  /** Titre court affiché en gras */
  titre: string;
  /** Description de l'étape (1–2 phrases) */
  desc: string;
  /** Badge optionnel : "clé" | "optionnel" | n'importe quelle chaîne */
  tag?: string;
  /** Note contextuelle (conseil vert ou avertissement orange) */
  note?: FluxNote;
};

export interface FluxDiagramProps {
  /** Sous-titre affiché en petites capitales */
  titre?: string;
  steps: FluxStep[];
}

// ─── Layout ──────────────────────────────────────────────────────────────────

const VW         = 640;            // viewBox width (fixe)
const CARD_X     = 0;    
const CARD_W     = VW - CARD_X - 2; 
const ARROW_X    = CARD_X + Math.floor(CARD_W / 2);   // centre des cartes
const CONN_H     = 36;             // hauteur totale du connecteur entre deux cartes
const CONN_GAP   = 5;              // espace entre bord de carte et début/fin du trait
const PAD        = 14;
const LH14       = 14 * 1.45;
const LH12       = 12 * 1.45;
const LH11       = 11 * 1.45;
const TAG_H      = 18;
const RX         = 9;

// ─── Text wrap ───────────────────────────────────────────────────────────────

function cpl(sz: number) {
  return Math.floor((CARD_W - PAD * 2 - 20) / (sz * 0.535));
}

function wrapText(text: string, sz: number): string[] {
  const limit = cpl(sz);
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const word of words) {
    const candidate = cur ? cur + " " + word : word;
    if (candidate.length > limit && cur) { lines.push(cur); cur = word; }
    else cur = candidate;
  }
  if (cur) lines.push(cur);
  return lines;
}

function cardHeight(step: FluxStep): number {
  let h = PAD;
  h += LH14;
  h += 6;
  h += wrapText(step.desc, 12).length * LH12;
  if (step.note) {
    h += 10;
    h += Math.max(32, wrapText(step.note.text, 11).length * LH11 + 18);
  }
  h += PAD;
  return Math.ceil(h);
}

// ─── Palette ─────────────────────────────────────────────────────────────────

function palette(dark: boolean) {
  return {
    cardFill:   dark ? "#1e1e1e" : "#ffffff",
    cardStroke: dark ? "#3a3a3a" : "#d0cfc8",
    numFill:    dark ? "#2c2c2c" : "#f2f1ea",
    numStroke:  dark ? "#444"    : "#c8c7c0",
    numText:    dark ? "#999"    : "#666",
    title:      dark ? "#e8e6de" : "#1a1a18",
    desc:       dark ? "#888"    : "#666",
    arrow:      dark ? "#585856" : "#a0a09a",
    accent:     "#1B6AC9",
    accentText: "#ffffff",
    tagBg:      dark ? "#162840" : "#deeaf9",
    tagFg:      dark ? "#5fa0e8" : "#154f9a",
    optBg:      dark ? "#2a2a28" : "#eeede6",
    optFg:      dark ? "#777"    : "#888",
    tipBg:      dark ? "#0a1f14" : "#e1f5ee",
    tipFg:      dark ? "#4ecb87" : "#0a5c42",
    tipBar:     dark ? "#2a8a5c" : "#0f6e56",
    warnBg:     dark ? "#1f1200" : "#fff0dc",
    warnFg:     dark ? "#d4892a" : "#7a3800",
    warnBar:    dark ? "#a06020" : "#c46800",
  };
}

type Palette = ReturnType<typeof palette>;

// ─── SVG text helper ─────────────────────────────────────────────────────────

type DominantBaseline = "hanging" | "auto" | "use-script" | "no-change" | "reset-size" | "ideographic" | "alphabetic" | "mathematical" | "central" | "middle" | "text-after-edge" | "text-before-edge" | "inherit" | undefined; 
type TextAnchor = "middle" | "inherit" | "start" | "end" | undefined;

interface TxtProps {
  x: number; y: number;
  size: number; fill: string; weight?: number;
  baseline?: DominantBaseline; anchor?: TextAnchor;
  children: React.ReactNode;
}
function Txt({ x, y, size, fill, weight = 400, baseline = "hanging", anchor = "start", children }: TxtProps) {
  return (
    <text
      x={x} y={y}
      fontSize={size} fill={fill} fontWeight={weight}
      dominantBaseline={baseline} textAnchor={anchor}
      fontFamily="var(--sl-font, var(--font-sans, sans-serif))"
    >{children}</text>
  );
}

// ─── StepNode ────────────────────────────────────────────────────────────────

interface StepNodeProps {
  step: FluxStep;
  index: number;
  isActive: boolean;
  isLast: boolean;
  cy: number;           // centre Y du cercle numéro
  cardTop: number;
  cH: number;
  nextCardTop: number;  // top de la carte suivante (utilisé pour tracer la flèche exacte)
  p: Palette;
  onToggle: (i: number) => void;
}

function StepNode({
  step, index, isActive, isLast,
  cy, cardTop, cH, nextCardTop,
  p, onToggle,
}: StepNodeProps) {
  const tx = CARD_X + PAD;

  // Coordonnées de la flèche : part du bas de cette carte, arrive au haut de la suivante
  const arrowY1 = cardTop + cH + CONN_GAP;
  const arrowY2 = nextCardTop - CONN_GAP;

  const descLines  = wrapText(step.desc, 12);
  const noteLines  = step.note ? wrapText(step.note.text, 11) : [];
  const noteH      = step.note ? Math.max(32, noteLines.length * LH11 + 18) : 0;
  const noteY      = cardTop + PAD + LH14 + 6 + descLines.length * LH12 + 10;

  return (
    <g>
      {/* ── Carte ── */}
      <rect
        x={CARD_X} y={cardTop} width={CARD_W} height={cH} rx={RX}
        fill={p.cardFill}
        stroke={isActive ? p.accent : p.cardStroke}
        strokeWidth={isActive ? 1.5 : 0.5}
        style={{ cursor: "pointer" }}
        onClick={() => onToggle(index)}
      />

      {/* ── Titre ── */}
      <Txt x={tx} y={cardTop + PAD} size={14} fill={p.title} weight={600}>{step.titre}</Txt>

      {/* ── Tag badge ── */}
      {step.tag && (() => {
        const bg  = step.tag === "optionnel" ? p.optBg : p.tagBg;
        const fg  = step.tag === "optionnel" ? p.optFg : p.tagFg;
        const tagX = tx + step.titre.length * 14 * 0.6 + 8;
        const tagW = step.tag.length * 7.5 + 16;
        return (
          <>
            <rect x={tagX} y={cardTop + PAD} width={tagW} height={TAG_H} rx={999} fill={bg} />
            <Txt x={tagX + tagW / 2} y={cardTop + PAD + TAG_H / 2}
              size={10} fill={fg} weight={600} baseline="central" anchor="middle">{step.tag}</Txt>
          </>
        );
      })()}

      {/* ── Description ── */}
      {descLines.map((line, li) => (
        <Txt key={li} x={tx} y={cardTop + PAD + LH14 + 6 + li * LH12}
          size={12} fill={p.desc}>{line}</Txt>
      ))}

      {/* ── Note ── */}
      {step.note && (
        <>
          <rect x={tx} y={noteY} width={CARD_W - PAD * 2} height={noteH} rx={6}
            fill={step.note.type === "warn" ? p.warnBg : p.tipBg} />
          <rect x={tx} y={noteY} width={3} height={noteH} rx={1.5}
            fill={step.note.type === "warn" ? p.warnBar : p.tipBar} />
          <Txt x={tx + 10} y={noteY + 10} size={11}
            fill={step.note.type === "warn" ? p.warnFg : p.tipFg} weight={600}>
            {step.note.type === "warn" ? "⚠" : "✓"}
          </Txt>
          {noteLines.map((line, li) => (
            <Txt key={li} x={tx + 22} y={noteY + 10 + li * LH11}
              size={11} fill={step.note!.type === "warn" ? p.warnFg : p.tipFg}>{line}</Txt>
          ))}
        </>
      )}

      {/* ── Flèche card-to-card ── */}
      {!isLast && (
        <line
          x1={ARROW_X} y1={arrowY1}
          x2={ARROW_X} y2={arrowY2}
          stroke={p.arrow}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={step.tag === "optionnel" ? "5 4" : undefined}
          markerEnd="url(#fd-arrow)"
        />
      )}
    </g>
  );
}

// ─── FluxDiagram ─────────────────────────────────────────────────────────────

export default function FluxDiagram({ titre, steps }: FluxDiagramProps) {
  const [active, setActive]   = useState<number | null>(null);
  const [dark,   setDark]     = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const obs = new MutationObserver(() => {
      const attr = document.documentElement.getAttribute("data-theme");
      setDark(attr === "dark" || (!attr && mq.matches));
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    mq.addEventListener("change", e => setDark(e.matches));
    return () => obs.disconnect();
  }, []);

  const toggle = (i: number) => setActive(prev => prev === i ? null : i);
  const p = palette(dark);

  // ── Layout : compute cardTop for every step ──────────────────────────────
  const heights    = steps.map(cardHeight);
  const cardTops: number[] = [];
  let cursor = 0;
  heights.forEach((h, i) => {
    cardTops.push(cursor);
    cursor += h;
    if (i < steps.length - 1) cursor += CONN_H;
  });
  const totalH = cursor + 8;

  return (
    <svg
      viewBox={`0 0 ${VW} ${totalH}`}
      width="100%"
      style={{ display: "block", overflow: "visible", margin: "1.5rem 0" }}
      role="img"
      aria-label={titre ?? "Diagramme de flux"}
    >
      <defs>
        {titre && <title>{titre}</title>}
        {/*
          refX="9" place la POINTE de la flèche exactement à (x2, y2),
          ce qui permet de l'aligner précisément sur le bord de la carte suivante.
        */}
        <marker id="fd-arrow" viewBox="0 0 10 10" refX="9" refY="5"
          markerWidth={7} markerHeight={7} orient="auto">
          <path d="M1 1L9 5L1 9" fill="none" stroke={p.arrow}
            strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
        </marker>
      </defs>

      {steps.map((step, i) => (
        <StepNode
          key={i}
          step={step}
          index={i}
          isActive={active === i}
          isLast={i === steps.length - 1}
          cy={cardTops[i]}
          cardTop={cardTops[i]}
          cH={heights[i]}
          nextCardTop={cardTops[i + 1] ?? 0}
          p={p}
          onToggle={toggle}
        />
      ))}
    </svg>
  );
}
