import { type CSSProperties, useEffect, useRef, useState } from "react";
import {
  MODE_FRAMES,
  type OrbFrame,
  type OrbSize,
  type OrbState,
  type OrbTheme,
  resolvePreset,
  scaleCounts,
  scaleRadii,
  ThinkingOrb,
  type ThinkingOrbProps,
} from "thinking-orbs";

export type OtographyOrbPalette = "icon" | "icon-flow" | "icon-mesh";

export interface OtographyOrbProps extends ThinkingOrbProps {
  /**
   * otography アイコン由来のグラデーションパレット。
   * - `"icon"`: アイコンと同じ向き（4隅の静的グラデーション）
   * - `"icon-flow"`: 4隅のグラデーションを単純回転させる
   * - `"icon-mesh"`: 5つの色ノードがリサジュー軌道で移動し、ドメインワーピング＋RBF補間で溶け合う複雑な Animated Mesh
   * `color` prop を明示指定した場合は、本家 `ThinkingOrb` の単色 tint を使用する。
   */
  palette?: OtographyOrbPalette;
}

interface RGB {
  r: number;
  g: number;
  b: number;
}

// otography-icon.png の4隅の色（ダーク背景用: 鮮やか / ライト背景用: 白背景で黄色が飛ばないよう微調整）
const PALETTE_DARK: { tl: RGB; tr: RGB; bl: RGB; br: RGB } = {
  tl: { r: 255, g: 122, b: 42 }, // タンジェリンオレンジ
  tr: { r: 255, g: 30, b: 122 }, // ホットピンク
  bl: { r: 255, g: 222, b: 68 }, // サニーイエロー
  br: { r: 255, g: 112, b: 124 }, // コーラルピンク
};

const PALETTE_LIGHT: { tl: RGB; tr: RGB; bl: RGB; br: RGB } = {
  tl: { r: 245, g: 92, b: 28 }, // 深いタンジェリン
  tr: { r: 236, g: 20, b: 108 }, // 深いホットピンク
  bl: { r: 242, g: 162, b: 18 }, // アンバーゴールド（白背景でも視認性を確保）
  br: { r: 238, g: 76, b: 96 }, // コーラルローズ
};

const LABELS: Record<OrbState, string> = {
  working: "Working…",
  searching: "Searching…",
  solving: "Solving…",
  listening: "Listening…",
  connecting: "Connecting…",
  weaving: "Weaving…",
  composing: "Composing…",
  breathing: "Thinking…",
  shaping: "Shaping…",
};

function clamp01(v: number) {
  return Math.max(0, Math.min(1, v));
}

function sampleIconGradient(
  x: number,
  y: number,
  size: number,
  dark: boolean,
  angleRad: number,
): RGB {
  // オーブ領域（おおよそ中心±42%）を 0..1 に正規化し、端の色がしっかり出るようにする
  const cx = size * 0.5;
  const cy = size * 0.5;
  const span = size * 0.44 || 1;
  let nx = (x - cx) / span;
  let ny = (y - cy) / span;

  if (angleRad !== 0) {
    const c = Math.cos(angleRad);
    const s = Math.sin(angleRad);
    const rx = nx * c - ny * s;
    const ry = nx * s + ny * c;
    nx = rx;
    ny = ry;
  }

  const u = clamp01(nx * 0.5 + 0.5);
  const v = clamp01(ny * 0.5 + 0.5);
  const p = dark ? PALETTE_DARK : PALETTE_LIGHT;

  const topR = p.tl.r + (p.tr.r - p.tl.r) * u;
  const topG = p.tl.g + (p.tr.g - p.tl.g) * u;
  const topB = p.tl.b + (p.tr.b - p.tl.b) * u;

  const botR = p.bl.r + (p.br.r - p.bl.r) * u;
  const botG = p.bl.g + (p.br.g - p.bl.g) * u;
  const botB = p.bl.b + (p.br.b - p.bl.b) * u;

  return {
    r: topR + (botR - topR) * v,
    g: topG + (botG - topG) * v,
    b: topB + (botB - topB) * v,
  };
}

interface MeshNode {
  x: number;
  y: number;
  weight: number;
  invSpread: number;
  color: RGB;
}

// 5つの色ノード（otography-icon.png の特徴的な色塊）
// 互いに非整数比の周波数でリサジュー軌道を漂い、影響範囲も呼吸する
const MESH_NODE_SPECS: ReadonlyArray<{
  baseX: number;
  baseY: number;
  ampX: number;
  ampY: number;
  freqX: number;
  freqY: number;
  phaseX: number;
  phaseY: number;
  spread: number;
  pulseFreq: number;
  pulsePhase: number;
  dark: RGB;
  light: RGB;
}> = [
  {
    // Sunny Yellow（左下からうねる光の核）
    baseX: -0.45,
    baseY: 0.48,
    ampX: 0.42,
    ampY: 0.34,
    freqX: 0.53,
    freqY: 0.71,
    phaseX: 0.2,
    phaseY: 1.4,
    spread: 0.62,
    pulseFreq: 0.83,
    pulsePhase: 0.0,
    dark: { r: 255, g: 224, b: 64 },
    light: { r: 245, g: 168, b: 14 },
  },
  {
    // Hot Pink / Magenta（右上からうねる鮮やかなマゼンタ）
    baseX: 0.48,
    baseY: -0.42,
    ampX: 0.38,
    ampY: 0.44,
    freqX: 0.61,
    freqY: 0.47,
    phaseX: 2.1,
    phaseY: 0.7,
    spread: 0.68,
    pulseFreq: 0.67,
    pulsePhase: 1.9,
    dark: { r: 255, g: 24, b: 122 },
    light: { r: 236, g: 16, b: 106 },
  },
  {
    // Tangerine Orange（左上〜中央を横断する温かなオレンジ）
    baseX: -0.42,
    baseY: -0.38,
    ampX: 0.46,
    ampY: 0.36,
    freqX: 0.43,
    freqY: 0.67,
    phaseX: 4.0,
    phaseY: 2.6,
    spread: 0.7,
    pulseFreq: 0.59,
    pulsePhase: 3.4,
    dark: { r: 255, g: 120, b: 36 },
    light: { r: 246, g: 92, b: 22 },
  },
  {
    // Vermilion Accent（中央寄りに熱量とコントラストを生む朱赤）
    baseX: 0.06,
    baseY: -0.1,
    ampX: 0.44,
    ampY: 0.42,
    freqX: 0.79,
    freqY: 0.59,
    phaseX: 1.1,
    phaseY: 4.3,
    spread: 0.54,
    pulseFreq: 0.91,
    pulsePhase: 4.8,
    dark: { r: 255, g: 56, b: 32 },
    light: { r: 232, g: 42, b: 28 },
  },
  {
    // Coral Peach（右下〜下側を繋ぐ柔らかなコーラル）
    baseX: 0.4,
    baseY: 0.42,
    ampX: 0.36,
    ampY: 0.38,
    freqX: 0.57,
    freqY: 0.83,
    phaseX: 5.2,
    phaseY: 3.1,
    spread: 0.66,
    pulseFreq: 0.73,
    pulsePhase: 2.5,
    dark: { r: 255, g: 118, b: 132 },
    light: { r: 238, g: 76, b: 102 },
  },
];

function computeMeshNodes(t: number, dark: boolean): MeshNode[] {
  return MESH_NODE_SPECS.map((spec) => {
    const x = spec.baseX + Math.sin(t * spec.freqX + spec.phaseX) * spec.ampX;
    const y = spec.baseY + Math.cos(t * spec.freqY + spec.phaseY) * spec.ampY;
    const pulse = 1 + 0.28 * Math.sin(t * spec.pulseFreq + spec.pulsePhase);
    const spread = spec.spread * (0.9 + 0.16 * Math.cos(t * spec.pulseFreq * 0.7 + spec.phaseX));
    return {
      x,
      y,
      weight: pulse,
      invSpread: 1 / (spread * spread),
      color: dark ? spec.dark : spec.light,
    };
  });
}

function sampleAnimatedMesh(
  x: number,
  y: number,
  z: number,
  size: number,
  t: number,
  nodes: readonly MeshNode[],
): RGB {
  const cx = size * 0.5;
  const cy = size * 0.5;
  const span = size * 0.44 || 1;
  const nx = (x - cx) / span;
  const ny = (y - cy) / span;

  // 2段のドメインワーピング（空間自体を波打たせ、3D奥行き z も少し混ぜて多層感を出す）
  const w1x = Math.sin(ny * 2.3 + t * 0.95 + z * 0.45) * 0.24;
  const w1y = Math.cos(nx * 2.1 - t * 0.82 - z * 0.35) * 0.24;
  const wx = nx + w1x + Math.cos((ny + w1y) * 3.1 - t * 0.65) * 0.12;
  const wy = ny + w1y + Math.sin((nx + w1x) * 2.9 + t * 0.72) * 0.12;

  let rSum = 0;
  let gSum = 0;
  let bSum = 0;
  let wSum = 1e-4;

  for (const node of nodes) {
    const dx = wx - node.x;
    const dy = wy - node.y;
    const w = node.weight * Math.exp(-(dx * dx + dy * dy) * node.invSpread);
    rSum += node.color.r * w;
    gSum += node.color.g * w;
    bSum += node.color.b * w;
    wSum += w;
  }

  return {
    r: rSum / wSum,
    g: gSum / wSum,
    b: bSum / wSum,
  };
}

function shadedColor(rgb: RGB, white: number, alpha: number, dark: boolean) {
  const w = clamp01(white);
  const ramp = (c: number) => Math.round(dark ? c * (1 - w) : c + (255 - c) * w);
  return `rgba(${ramp(rgb.r)},${ramp(rgb.g)},${ramp(rgb.b)},${alpha})`;
}

function paintGradientFrame(
  ctx: CanvasRenderingContext2D,
  frame: OrbFrame,
  size: number,
  dark: boolean,
  palette: OtographyOrbPalette,
  meshTime: number,
) {
  const meshNodes = palette === "icon-mesh" ? computeMeshNodes(meshTime, dark) : null;
  const flowAngle = palette === "icon-flow" ? meshTime * 0.55 : 0;

  for (const line of frame.lines) {
    const alpha = line.a ?? 1;
    const mx = (line.x1 + line.x2) * 0.5;
    const my = (line.y1 + line.y2) * 0.5;
    const rgb = meshNodes
      ? sampleAnimatedMesh(mx, my, 0, size, meshTime, meshNodes)
      : sampleIconGradient(mx, my, size, dark, flowAngle);
    ctx.strokeStyle = shadedColor(rgb, line.white, alpha, dark);
    ctx.lineWidth = line.w;
    ctx.beginPath();
    ctx.moveTo(line.x1, line.y1);
    ctx.lineTo(line.x2, line.y2);
    ctx.stroke();
  }

  for (const dot of frame.dots) {
    const alpha = dot.a ?? 1;
    const rgb = meshNodes
      ? sampleAnimatedMesh(dot.x, dot.y, dot.z, size, meshTime, meshNodes)
      : sampleIconGradient(dot.x, dot.y, size, dark, flowAngle);
    ctx.fillStyle = shadedColor(rgb, dot.white, alpha, dark);
    ctx.beginPath();
    ctx.arc(dot.x, dot.y, dot.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function useResolvedDark(theme: OrbTheme) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    if (theme === "dark") {
      setDark(true);
      return;
    }
    if (theme === "light") {
      setDark(false);
      return;
    }
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    setDark(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setDark(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [theme]);

  return dark;
}

function useReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (event: MediaQueryListEvent) => setReduced(event.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

function GradientOrbCanvas({
  state = "working",
  size = 64,
  theme = "auto",
  speed = 1,
  paused = false,
  dots = 1,
  dotSize = 1,
  opts: optsOverride,
  frame: customFrame,
  palette = "icon",
  style,
  "aria-label": ariaLabel,
  ...rest
}: Omit<OtographyOrbProps, "color" | "gravity">) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const dark = useResolvedDark(theme);
  const reduced = useReducedMotion();
  const optsKey = optsOverride ? JSON.stringify(optsOverride) : "";

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;

    const dpr = Math.min(2, (typeof devicePixelRatio !== "undefined" && devicePixelRatio) || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { mode, speed: baseSpeed, opts: presetOpts } = resolvePreset(state, size as OrbSize);
    let opts = dots !== 1 ? scaleCounts(presetOpts, Math.max(0.1, dots)) : presetOpts;
    if (dotSize !== 1) opts = scaleRadii(opts, Math.max(0.1, dotSize));
    if (optsOverride) opts = { ...opts, ...optsOverride };

    const frameFn = customFrame ?? MODE_FRAMES[mode];
    const effSpeed = baseSpeed * speed;

    const renderFrame = (nowSec: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, size, size);
      const frame = frameFn(size, nowSec * effSpeed, opts);
      paintGradientFrame(ctx, frame, size, dark, palette, nowSec * speed);
    };

    if (reduced) {
      renderFrame(0.6);
      return;
    }

    let rafId = 0;
    let running = false;

    const loop = () => {
      renderFrame(performance.now() / 1000);
      if (running) rafId = requestAnimationFrame(loop);
    };

    const start = () => {
      if (running || paused) return;
      running = true;
      rafId = requestAnimationFrame(loop);
    };

    const stop = () => {
      running = false;
      cancelAnimationFrame(rafId);
    };

    renderFrame(performance.now() / 1000);

    let visible = true;
    const io =
      typeof IntersectionObserver !== "undefined"
        ? new IntersectionObserver(([entry]) => {
            visible = entry.isIntersecting;
            if (visible && document.visibilityState !== "hidden") start();
            else stop();
          })
        : null;
    io?.observe(canvas);

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") stop();
      else if (visible) start();
    };
    document.addEventListener("visibilitychange", onVisibilityChange);
    if (!io) start();

    return () => {
      stop();
      io?.disconnect();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [state, size, dark, speed, paused, reduced, dots, dotSize, optsKey, customFrame, palette]);

  const canvasStyle: CSSProperties = {
    width: size,
    height: size,
    display: "block",
    ...style,
  };

  return (
    <canvas
      ref={ref}
      role="img"
      aria-label={ariaLabel ?? LABELS[state]}
      style={canvasStyle}
      {...rest}
    />
  );
}

export function OtographyOrb({ palette = "icon-mesh", color, ...props }: OtographyOrbProps) {
  if (color !== undefined) {
    return <ThinkingOrb color={color} {...props} />;
  }
  return <GradientOrbCanvas palette={palette} {...props} />;
}
