import { create, props as stylexProps } from "@stylexjs/stylex";
import { createContext, use, useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode, RefObject } from "react";
import { chatTokens as t } from "./tokens.stylex";

type NoteGlyphKind = "eighth" | "beamed" | "quarter" | "double";
type SpawnSide = "top" | "left" | "bottom" | "right";

type Point = {
  x: number;
  y: number;
};

type FloatingNote = {
  id: number;
  glyph: NoteGlyphKind;
  size: number;
  peakOpacity: number;
  p0: Point;
  p1: Point;
  p2: Point;
  p3: Point;
  swayAmp: number;
  swayCycles: number;
  swayPhase: number;
  rotAmp: number;
  rotPhase: number;
  durationMs: number;
};

type SearchingNotesContextValue = {
  state: {
    active: boolean;
    speedScale: number;
  };
  actions: {
    setActive: (active: boolean) => void;
  };
  meta: {
    targetRef: RefObject<HTMLElement | null>;
    registerTarget: (node: HTMLElement | null) => void;
  };
};

const SearchingNotesContext = createContext<SearchingNotesContextValue | null>(null);

export function useSearchingNotes(): SearchingNotesContextValue | null {
  return use(SearchingNotesContext);
}

const MAX_CONCURRENT_NOTES = 10;
const KEYFRAME_SAMPLES = 36;
const GLYPHS: ReadonlyArray<NoteGlyphKind> = ["eighth", "beamed", "quarter", "double"];
const SIDES: ReadonlyArray<SpawnSide> = ["top", "left", "bottom", "right"];

function randomRange(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function easeOutCubic(tVal: number): number {
  const inv = 1 - tVal;
  return 1 - inv * inv * inv;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const clamped = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return clamped * clamped * (3 - 2 * clamped);
}

function cubicBezier(p0: Point, p1: Point, p2: Point, p3: Point, u: number): Point {
  const inv = 1 - u;
  const inv2 = inv * inv;
  const inv3 = inv2 * inv;
  const u2 = u * u;
  const u3 = u2 * u;
  return {
    x: inv3 * p0.x + 3 * inv2 * u * p1.x + 3 * inv * u2 * p2.x + u3 * p3.x,
    y: inv3 * p0.y + 3 * inv2 * u * p1.y + 3 * inv * u2 * p2.y + u3 * p3.y,
  };
}

function cubicBezierTangent(p0: Point, p1: Point, p2: Point, p3: Point, u: number): Point {
  const inv = 1 - u;
  return {
    x: 3 * inv * inv * (p1.x - p0.x) + 6 * inv * u * (p2.x - p1.x) + 3 * u * u * (p3.x - p2.x),
    y: 3 * inv * inv * (p1.y - p0.y) + 6 * inv * u * (p2.y - p1.y) + 3 * u * u * (p3.y - p2.y),
  };
}

/**
 * バブル全周（上・左・下・右）から出現し、外周を回り込みながら
 * 返信チャットのアイコン下付近（target）へ収束する 3 次ベジェ軌道を生成する。
 */
function createNote(
  id: number,
  slotIndex: number,
  width: number,
  height: number,
  target: Point,
): FloatingNote {
  const side = SIDES[slotIndex % SIDES.length] ?? "top";
  const end: Point = {
    x: target.x + randomRange(-16, 22),
    y: target.y + randomRange(8, 30),
  };
  const outerLeft = Math.min(end.x - randomRange(14, 34), -24);

  let p0: Point;
  let p1: Point;
  let p2: Point;

  if (side === "top") {
    p0 = { x: randomRange(width * 0.14, width * 0.86), y: randomRange(-8, 2) };
    p1 = { x: (p0.x + outerLeft) * 0.45, y: randomRange(-46, -18) };
    p2 = { x: outerLeft, y: (height + end.y) * 0.42 };
  } else if (side === "left") {
    p0 = { x: randomRange(-8, 2), y: randomRange(height * 0.14, height * 0.82) };
    p1 = { x: outerLeft - randomRange(6, 20), y: p0.y + randomRange(-12, 20) };
    p2 = { x: outerLeft + randomRange(0, 18), y: end.y - randomRange(8, 30) };
  } else if (side === "right") {
    p0 = { x: width + randomRange(-2, 8), y: randomRange(height * 0.2, height * 0.84) };
    p1 = { x: width + randomRange(20, 42), y: height + randomRange(22, 48) };
    p2 = { x: (width * 0.35 + end.x) * 0.5, y: end.y + randomRange(18, 42) };
  } else {
    p0 = { x: randomRange(width * 0.16, width * 0.84), y: height + randomRange(-2, 8) };
    p1 = { x: p0.x - randomRange(24, 72), y: height + randomRange(34, 62) };
    p2 = { x: end.x + randomRange(40, 110), y: end.y + randomRange(16, 38) };
  }

  return {
    id,
    glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)] ?? "eighth",
    size: Math.round(randomRange(13, 18)),
    peakOpacity: randomRange(0.48, 0.74),
    p0,
    p1,
    p2,
    p3: end,
    swayAmp: randomRange(6, 12),
    swayCycles: randomRange(1.1, 1.6),
    swayPhase: randomRange(0, Math.PI * 2),
    rotAmp: randomRange(9, 15),
    rotPhase: randomRange(0, Math.PI * 2),
    durationMs: Math.round(randomRange(3900, 5200)),
  };
}

function buildKeyframes(note: FloatingNote): Array<Keyframe> {
  const frames: Array<Keyframe> = [];
  const startSway = Math.sin(note.swayPhase);
  const startRot = Math.sin(note.rotPhase);

  for (let i = 0; i <= KEYFRAME_SAMPLES; i += 1) {
    const u = i / KEYFRAME_SAMPLES;
    const base = cubicBezier(note.p0, note.p1, note.p2, note.p3, u);
    const tangent = cubicBezierTangent(note.p0, note.p1, note.p2, note.p3, u);
    const len = Math.hypot(tangent.x, tangent.y) || 1;
    const nx = -tangent.y / len;
    const ny = tangent.x / len;

    const rampIn = smoothstep(0, 0.14, u);
    const rampOut = 1 - 0.55 * smoothstep(0.76, 1, u);
    const sway =
      (Math.sin(u * Math.PI * 2 * note.swayCycles + note.swayPhase) - startSway) *
      note.swayAmp *
      rampIn *
      rampOut;
    const x = base.x + nx * sway;
    const y = base.y + ny * sway;

    const lean = Math.max(-9, Math.min(9, (tangent.x / len) * 9));
    const rot =
      lean * rampIn +
      (Math.sin(u * Math.PI * 2 * 1.15 + note.rotPhase) - startRot) * note.rotAmp * rampIn;

    const enterScale = 0.9 + 0.1 * easeOutCubic(Math.min(1, u / 0.18));
    const exitScale = 1 - 0.08 * smoothstep(0.72, 1, u);
    const scale = enterScale * exitScale;

    const fadeIn = smoothstep(0, 0.16, u);
    const fadeOut = 1 - smoothstep(0.7, 1, u);
    const opacity = note.peakOpacity * fadeIn * fadeOut;

    frames.push({
      offset: u,
      opacity: Number(opacity.toFixed(3)),
      transform: `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`,
    });
  }

  return frames;
}

function NoteGlyph({ kind, size }: { kind: NoteGlyphKind; size: number }) {
  if (kind === "beamed") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M6 11.8V4.2l6.2-1.2v7.6"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="4.3" cy="11.8" r="1.7" stroke="currentColor" strokeWidth="1.4" />
        <circle cx="10.5" cy="10.6" r="1.7" stroke="currentColor" strokeWidth="1.4" />
      </svg>
    );
  }

  if (kind === "quarter") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path d="M9.5 11.4V3.4" stroke="currentColor" strokeWidth="1.45" strokeLinecap="round" />
        <ellipse
          cx="7.3"
          cy="11.6"
          rx="2.3"
          ry="1.7"
          transform="rotate(-18 7.3 11.6)"
          fill="currentColor"
        />
      </svg>
    );
  }

  if (kind === "double") {
    return (
      <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
        <path
          d="M5.8 11.6V3.9l6.4-1.1v7.4M5.8 6.3l6.4-1.1"
          stroke="currentColor"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <ellipse
          cx="4.2"
          cy="11.8"
          rx="1.8"
          ry="1.35"
          transform="rotate(-16 4.2 11.8)"
          fill="currentColor"
        />
        <ellipse
          cx="10.6"
          cy="10.4"
          rx="1.8"
          ry="1.35"
          transform="rotate(-16 10.6 10.4)"
          fill="currentColor"
        />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M8.6 11.5V3.3c1.6.5 3 1.6 3.2 3.3"
        stroke="currentColor"
        strokeWidth="1.45"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <ellipse
        cx="6.4"
        cy="11.7"
        rx="2.3"
        ry="1.7"
        transform="rotate(-18 6.4 11.7)"
        fill="currentColor"
      />
    </svg>
  );
}

function FloatingNoteParticle({
  note,
  speedScale,
  onDone,
}: {
  note: FloatingNote;
  speedScale: number;
  onDone: (id: number) => void;
}) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const animRef = useRef<Animation | null>(null);
  const onDoneRef = useRef(onDone);
  const initialSpeedScaleRef = useRef(speedScale);

  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof el.animate !== "function") {
      return;
    }

    const keyframes = buildKeyframes(note);
    const anim = el.animate(keyframes, {
      duration: note.durationMs,
      easing: "linear",
      fill: "forwards",
    });
    anim.playbackRate = initialSpeedScaleRef.current;
    animRef.current = anim;

    let cancelled = false;
    anim.onfinish = () => {
      if (!cancelled) {
        onDoneRef.current(note.id);
      }
    };

    return () => {
      cancelled = true;
      anim.cancel();
      animRef.current = null;
    };
  }, [note]);

  useEffect(() => {
    initialSpeedScaleRef.current = speedScale;
    if (animRef.current) {
      animRef.current.playbackRate = speedScale;
    }
  }, [speedScale]);

  return (
    <span ref={ref} {...stylexProps(styles.particle)}>
      <NoteGlyph kind={note.glyph} size={note.size} />
    </span>
  );
}

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false,
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function Provider({
  active: controlledActive,
  defaultActive = false,
  speedScale = 1,
  children,
}: {
  active?: boolean;
  defaultActive?: boolean;
  speedScale?: number;
  children: ReactNode;
}) {
  const [internalActive, setInternalActive] = useState(defaultActive);
  const targetRef = useRef<HTMLElement | null>(null);
  const registerTarget = useCallback((node: HTMLElement | null) => {
    targetRef.current = node;
  }, []);

  const active = controlledActive ?? internalActive;

  return (
    <SearchingNotesContext
      value={{
        state: { active, speedScale },
        actions: { setActive: setInternalActive },
        meta: { targetRef, registerTarget },
      }}
    >
      {children}
    </SearchingNotesContext>
  );
}

function Overlay() {
  const ctx = use(SearchingNotesContext);
  const active = ctx?.state.active ?? false;
  const speedScale = ctx?.state.speedScale ?? 1;
  const targetRef = ctx?.meta.targetRef;

  const reducedMotion = useReducedMotion();
  const layerRef = useRef<HTMLDivElement | null>(null);
  const [notes, setNotes] = useState<Array<FloatingNote>>([]);
  const nextIdRef = useRef(1);
  const slotRef = useRef(0);

  const removeNote = useCallback((id: number) => {
    setNotes((prev) => prev.filter((item) => item.id !== id));
  }, []);

  useEffect(() => {
    if (reducedMotion || !active) {
      // 結果が出たら新規生成だけ止め、すでに流れている音符はそのまま終点まで流し切る
      return;
    }

    const timers: Array<number> = [];
    let stopped = false;

    const spawn = () => {
      if (stopped) {
        return;
      }
      const layerRect = layerRef.current?.getBoundingClientRect();
      const width = layerRect && layerRect.width > 0 ? layerRect.width : 420;
      const height = layerRect && layerRect.height > 0 ? layerRect.height : 130;

      const targetEl = targetRef?.current;
      let target: Point;
      if (layerRect && targetEl) {
        const targetRect = targetEl.getBoundingClientRect();
        target = {
          x: targetRect.left + targetRect.width / 2 - layerRect.left,
          y: targetRect.bottom - layerRect.top,
        };
      } else {
        const leftClearance = layerRect ? Math.min(layerRect.left - 24, 150) : 120;
        target = {
          x: -Math.max(20, leftClearance),
          y: height + 56,
        };
      }

      const id = nextIdRef.current;
      nextIdRef.current += 1;
      const slot = slotRef.current;
      slotRef.current += 1;
      setNotes((prev) => {
        const trimmed = prev.length >= MAX_CONCURRENT_NOTES ? prev.slice(1) : prev;
        return [...trimmed, createNote(id, slot, width, height, target)];
      });
    };

    const burstDelays = [0, 110, 220, 330];
    for (const delay of burstDelays) {
      timers.push(window.setTimeout(spawn, Math.round(delay / speedScale)));
    }

    const scheduleNext = () => {
      if (stopped) {
        return;
      }
      const delayMs = Math.max(280, Math.round(randomRange(420, 580) / speedScale));
      const timerId = window.setTimeout(() => {
        spawn();
        scheduleNext();
      }, delayMs);
      timers.push(timerId);
    };

    timers.push(window.setTimeout(scheduleNext, Math.round(500 / speedScale)));

    return () => {
      stopped = true;
      for (const timer of timers) {
        window.clearTimeout(timer);
      }
    };
  }, [active, reducedMotion, speedScale, targetRef]);

  if (reducedMotion) {
    return (
      <div
        aria-hidden="true"
        {...stylexProps(
          styles.layer,
          styles.reducedLayer,
          active ? styles.layerVisible : styles.layerHidden,
        )}
      >
        <span {...stylexProps(styles.reducedNote, styles.reducedNoteTop)}>
          <NoteGlyph kind="eighth" size={14} />
        </span>
        <span {...stylexProps(styles.reducedNote, styles.reducedNoteLeft)}>
          <NoteGlyph kind="beamed" size={15} />
        </span>
        <span {...stylexProps(styles.reducedNote, styles.reducedNoteBottom)}>
          <NoteGlyph kind="quarter" size={13} />
        </span>
      </div>
    );
  }

  return (
    <div ref={layerRef} aria-hidden="true" {...stylexProps(styles.layer)}>
      {notes.map((note) => (
        <FloatingNoteParticle
          key={note.id}
          note={note}
          speedScale={speedScale}
          onDone={removeNote}
        />
      ))}
    </div>
  );
}

export const SearchingNotes = {
  Provider,
  Overlay,
};

const styles = create({
  layer: {
    position: "absolute",
    inset: 0,
    zIndex: 0,
    overflow: "visible",
    pointerEvents: "none",
  },
  reducedLayer: {
    transition: "opacity 160ms ease",
  },
  layerVisible: {
    opacity: 1,
  },
  layerHidden: {
    opacity: 0,
  },
  particle: {
    position: "absolute",
    top: 0,
    left: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: t.muted,
    opacity: 0,
    transform: "translate3d(0, 0, 0) scale(0.9)",
    willChange: "transform, opacity",
  },
  reducedNote: {
    position: "absolute",
    display: "inline-flex",
    color: t.muted,
    opacity: 0.55,
  },
  reducedNoteTop: {
    top: -18,
    left: "24%",
  },
  reducedNoteLeft: {
    top: "44%",
    left: -24,
  },
  reducedNoteBottom: {
    bottom: -20,
    left: "18%",
  },
});
