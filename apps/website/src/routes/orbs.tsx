import * as stylex from "@stylexjs/stylex";
import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { type OrbSize, type OrbState, ThinkingOrb } from "thinking-orbs";
import { OtographyOrb } from "#/chat/OtographyOrb";
import { motion } from "#/motion.stylex";

export const Route = createFileRoute("/orbs")({
  component: OrbsPlayground,
});

const ORB_STATES: ReadonlyArray<{ state: OrbState; label: string; desc: string }> = [
  { state: "working", label: "working", desc: "斜めの軌道上を粒子が周回する" },
  { state: "searching", label: "searching", desc: "走査線がドット球体をスキャンする" },
  { state: "solving", label: "solving", desc: "バンドが90度回転して噛み合う" },
  { state: "listening", label: "listening", desc: "緯度リングを波形が伝播する" },
  { state: "connecting", label: "connecting", desc: "星座のように結ばれパケットが走る" },
  { state: "weaving", label: "weaving", desc: "3本のストランドが球面を編み込む" },
  { state: "composing", label: "composing", desc: "多層の帯がうねりながら重なる" },
  { state: "breathing", label: "breathing", desc: "正面リングがゆっくり呼吸変形する" },
  { state: "shaping", label: "shaping", desc: "円 → 三角 → 四角へと輪郭が遷移する" },
];

type ColorPresetId =
  | "icon-mesh"
  | "icon-gradient"
  | "icon-flow"
  | "orange"
  | "pink"
  | "gold"
  | "grayscale";

const COLOR_PRESETS: ReadonlyArray<{
  id: ColorPresetId;
  label: string;
  swatch: string;
  solidColor?: string;
}> = [
  {
    id: "icon-mesh",
    label: "Animated Mesh",
    swatch:
      "radial-gradient(circle at 25% 75%, #ffe14d, transparent 58%), radial-gradient(circle at 75% 25%, #ff187a, transparent 58%), radial-gradient(circle at 30% 25%, #ff6a26, #ff3b1f)",
  },
  {
    id: "icon-gradient",
    label: "Icon Gradient",
    swatch: "linear-gradient(135deg, #ff7a29 0%, #ff1e7a 52%, #ffe14d 100%)",
  },
  {
    id: "icon-flow",
    label: "Icon Flow",
    swatch: "conic-gradient(from 45deg, #ff7a29, #ff1e7a, #ff707c, #ffe14d, #ff7a29)",
  },
  {
    id: "orange",
    label: "Tangerine",
    swatch: "#ff5a26",
    solidColor: "#ff5a26",
  },
  {
    id: "pink",
    label: "Hot Pink",
    swatch: "#ff1e7a",
    solidColor: "#ff1e7a",
  },
  {
    id: "gold",
    label: "Sun Gold",
    swatch: "#f59e0b",
    solidColor: "#f59e0b",
  },
  {
    id: "grayscale",
    label: "Stock Gray",
    swatch: "#888888",
  },
];

const SIZES: ReadonlyArray<OrbSize> = [64, 32, 20];

function RenderOrb({
  state,
  size,
  dark,
  speed,
  paused,
  presetId,
}: {
  state: OrbState;
  size: OrbSize;
  dark: boolean;
  speed: number;
  paused: boolean;
  presetId: ColorPresetId;
}) {
  const theme = dark ? "dark" : "light";

  if (presetId === "icon-mesh") {
    return (
      <OtographyOrb
        state={state}
        size={size}
        theme={theme}
        speed={speed}
        paused={paused}
        palette="icon-mesh"
      />
    );
  }
  if (presetId === "icon-gradient") {
    return (
      <OtographyOrb
        state={state}
        size={size}
        theme={theme}
        speed={speed}
        paused={paused}
        palette="icon"
      />
    );
  }
  if (presetId === "icon-flow") {
    return (
      <OtographyOrb
        state={state}
        size={size}
        theme={theme}
        speed={speed}
        paused={paused}
        palette="icon-flow"
      />
    );
  }
  if (presetId === "grayscale") {
    return <ThinkingOrb state={state} size={size} theme={theme} speed={speed} paused={paused} />;
  }

  const solid = COLOR_PRESETS.find((p) => p.id === presetId)?.solidColor;
  return (
    <ThinkingOrb
      state={state}
      size={size}
      theme={theme}
      speed={speed}
      paused={paused}
      color={solid}
    />
  );
}

function OrbsPlayground() {
  const [presetId, setPresetId] = useState<ColorPresetId>("icon-mesh");
  const [dark, setDark] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [paused, setPaused] = useState(false);
  const [selectedState, setSelectedState] = useState<OrbState>("searching");

  return (
    <div {...stylex.props(styles.page, dark ? styles.pageDark : styles.pageLight)}>
      <div {...stylex.props(styles.inner)}>
        <header {...stylex.props(styles.header)}>
          <div {...stylex.props(styles.titleRow)}>
            <img
              src="/otography-icon.png"
              alt="otography icon"
              width={40}
              height={40}
              {...stylex.props(styles.iconRef)}
            />
            <div>
              <h1 {...stylex.props(styles.title)}>Thinking Orbs × otography</h1>
              <p {...stylex.props(styles.subtitle, dark ? styles.mutedDark : styles.mutedLight)}>
                全 9 ステートに otography
                アイコン由来のグラデーション／カラーを適用したプレイグラウンド
              </p>
            </div>
          </div>

          <div {...stylex.props(styles.controls, dark ? styles.surfaceDark : styles.surfaceLight)}>
            <div {...stylex.props(styles.controlGroup)}>
              <span
                {...stylex.props(styles.controlLabel, dark ? styles.mutedDark : styles.mutedLight)}
              >
                Color
              </span>
              <div {...stylex.props(styles.pillRow)}>
                {COLOR_PRESETS.map((preset) => {
                  const active = preset.id === presetId;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => setPresetId(preset.id)}
                      {...stylex.props(
                        styles.pill,
                        dark ? styles.pillDark : styles.pillLight,
                        active && (dark ? styles.pillActiveDark : styles.pillActiveLight),
                      )}
                    >
                      <span
                        aria-hidden="true"
                        style={{ background: preset.swatch }}
                        {...stylex.props(styles.swatch)}
                      />
                      <span>{preset.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div {...stylex.props(styles.controlRow)}>
              <div {...stylex.props(styles.controlGroup)}>
                <span
                  {...stylex.props(
                    styles.controlLabel,
                    dark ? styles.mutedDark : styles.mutedLight,
                  )}
                >
                  Theme
                </span>
                <div {...stylex.props(styles.pillRow)}>
                  <button
                    type="button"
                    onClick={() => setDark(false)}
                    {...stylex.props(
                      styles.pill,
                      dark ? styles.pillDark : styles.pillLight,
                      !dark && styles.pillActiveLight,
                    )}
                  >
                    Light
                  </button>
                  <button
                    type="button"
                    onClick={() => setDark(true)}
                    {...stylex.props(
                      styles.pill,
                      dark ? styles.pillDark : styles.pillLight,
                      dark && styles.pillActiveDark,
                    )}
                  >
                    Dark
                  </button>
                </div>
              </div>

              <div {...stylex.props(styles.controlGroup)}>
                <label
                  htmlFor="orb-speed"
                  {...stylex.props(
                    styles.controlLabel,
                    dark ? styles.mutedDark : styles.mutedLight,
                  )}
                >
                  Speed: {speed.toFixed(2)}x
                </label>
                <input
                  id="orb-speed"
                  type="range"
                  min={0.25}
                  max={2.5}
                  step={0.05}
                  value={speed}
                  onChange={(event) => setSpeed(Number(event.currentTarget.value))}
                  {...stylex.props(styles.slider)}
                />
              </div>

              <div {...stylex.props(styles.controlGroup)}>
                <span
                  {...stylex.props(
                    styles.controlLabel,
                    dark ? styles.mutedDark : styles.mutedLight,
                  )}
                >
                  Playback
                </span>
                <button
                  type="button"
                  onClick={() => setPaused((prev) => !prev)}
                  {...stylex.props(
                    styles.pill,
                    dark ? styles.pillDark : styles.pillLight,
                    paused && (dark ? styles.pillActiveDark : styles.pillActiveLight),
                  )}
                >
                  {paused ? "Resume" : "Pause"}
                </button>
              </div>
            </div>
          </div>
        </header>

        <section
          aria-label="チャット内プレビュー"
          {...stylex.props(styles.previewCard, dark ? styles.surfaceDark : styles.surfaceLight)}
        >
          <div {...stylex.props(styles.previewHeader)}>
            <span
              {...stylex.props(styles.previewEyebrow, dark ? styles.mutedDark : styles.mutedLight)}
            >
              In-context Preview ({selectedState})
            </span>
          </div>
          <div {...stylex.props(styles.chatPreview)}>
            <div
              {...stylex.props(
                styles.chatAvatar,
                dark ? styles.chatAvatarDark : styles.chatAvatarLight,
              )}
            >
              <RenderOrb
                state={selectedState}
                size={32}
                dark={dark}
                speed={speed}
                paused={paused}
                presetId={presetId}
              />
            </div>
            <div {...stylex.props(styles.chatBody)}>
              <p {...stylex.props(styles.chatLead)}>
                「夜に駆ける」の感想を投稿しました。近い感覚の曲を探しています…
              </p>
              <div
                {...stylex.props(styles.inlineDemo, dark ? styles.mutedDark : styles.mutedLight)}
              >
                <RenderOrb
                  state={selectedState}
                  size={20}
                  dark={dark}
                  speed={speed}
                  paused={paused}
                  presetId={presetId}
                />
                <span>近い感覚の感想を検索中…（20px インライン表示）</span>
              </div>
            </div>
          </div>
        </section>

        <section aria-label="全 9 パターン" {...stylex.props(styles.grid)}>
          {ORB_STATES.map((item) => {
            const selected = item.state === selectedState;
            return (
              <button
                key={item.state}
                type="button"
                onClick={() => setSelectedState(item.state)}
                {...stylex.props(
                  styles.card,
                  dark ? styles.surfaceDark : styles.surfaceLight,
                  selected && styles.cardSelected,
                )}
              >
                <div {...stylex.props(styles.cardTop)}>
                  <span {...stylex.props(styles.stateName)}>{item.label}</span>
                  {selected ? <span {...stylex.props(styles.selectedBadge)}>Preview中</span> : null}
                </div>

                <div {...stylex.props(styles.stage)}>
                  <RenderOrb
                    state={item.state}
                    size={64}
                    dark={dark}
                    speed={speed}
                    paused={paused}
                    presetId={presetId}
                  />
                </div>

                <div
                  {...stylex.props(
                    styles.sizeStrip,
                    dark ? styles.sizeStripDark : styles.sizeStripLight,
                  )}
                >
                  {SIZES.map((sz) => (
                    <div key={sz} {...stylex.props(styles.sizeItem)}>
                      <div {...stylex.props(styles.sizeOrbSlot)}>
                        <RenderOrb
                          state={item.state}
                          size={sz}
                          dark={dark}
                          speed={speed}
                          paused={paused}
                          presetId={presetId}
                        />
                      </div>
                      <span
                        {...stylex.props(
                          styles.sizeLabel,
                          dark ? styles.mutedDark : styles.mutedLight,
                        )}
                      >
                        {sz}px
                      </span>
                    </div>
                  ))}
                </div>

                <p {...stylex.props(styles.cardDesc, dark ? styles.mutedDark : styles.mutedLight)}>
                  {item.desc}
                </p>
              </button>
            );
          })}
        </section>
      </div>
    </div>
  );
}

const styles = stylex.create({
  page: {
    minHeight: "100dvh",
    paddingInline: 20,
    paddingTop: "calc(32px + env(safe-area-inset-top, 0px))",
    paddingBottom: "calc(32px + env(safe-area-inset-bottom, 0px))",
    transition: "background-color 180ms ease, color 180ms ease",
  },
  pageDark: {
    color: "#f4f4f5",
    backgroundColor: "#111113",
  },
  pageLight: {
    color: "#171717",
    backgroundColor: "#faf9f7",
  },
  inner: {
    display: "flex",
    flexDirection: "column",
    gap: 20,
    width: "min(100%, 1040px)",
    marginBlock: 0,
    marginInline: "auto",
  },
  header: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  titleRow: {
    display: "flex",
    gap: 14,
    alignItems: "center",
  },
  iconRef: {
    display: "block",
    flexShrink: 0,
    width: 40,
    height: 40,
    borderRadius: 10,
    boxShadow: "0 4px 14px rgba(255, 68, 92, 0.25)",
  },
  title: {
    margin: 0,
    fontSize: "clamp(20px, 2.6vw, 26px)",
    fontWeight: 700,
    letterSpacing: "-0.02em",
  },
  subtitle: {
    marginTop: 4,
    marginRight: 0,
    marginBottom: 0,
    marginLeft: 0,
    fontSize: 13,
    lineHeight: 1.5,
  },
  mutedDark: {
    color: "#a1a1aa",
  },
  mutedLight: {
    color: "#63636e",
  },
  surfaceDark: {
    backgroundColor: "#18181b",
    borderColor: "#27272a",
  },
  surfaceLight: {
    backgroundColor: "#ffffff",
    borderColor: "#e6e4e0",
  },
  controls: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    paddingBlock: 14,
    paddingInline: 16,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 16,
  },
  controlRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 20,
    alignItems: "center",
  },
  controlGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  controlLabel: {
    fontSize: 11,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  pillRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  pill: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    height: 30,
    paddingBlock: 0,
    paddingInline: 11,
    fontSize: 12,
    fontWeight: 500,
    cursor: "pointer",
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9999,
    transform: {
      default: null,
      ":active": "scale(0.97)",
    },
    transition: `transform 150ms ${motion.easeOut}, background-color 150ms ease, border-color 150ms ease`,
  },
  pillDark: {
    color: "#e4e4e7",
    backgroundColor: "#202024",
    borderColor: "#323238",
  },
  pillLight: {
    color: "#27272a",
    backgroundColor: "#f5f4f1",
    borderColor: "#e2e0db",
  },
  pillActiveDark: {
    color: "#111113",
    backgroundColor: "#f4f4f5",
    borderColor: "#f4f4f5",
  },
  pillActiveLight: {
    color: "#ffffff",
    backgroundColor: "#171717",
    borderColor: "#171717",
  },
  swatch: {
    display: "inline-block",
    flexShrink: 0,
    width: 11,
    height: 11,
    borderRadius: 9999,
  },
  slider: {
    width: 148,
    accentColor: "#ff4d5a",
    cursor: "pointer",
  },
  previewCard: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
    paddingBlock: 16,
    paddingInline: 18,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 16,
  },
  previewHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  previewEyebrow: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  chatPreview: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
  },
  chatAvatar: {
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 38,
    height: 38,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9999,
  },
  chatAvatarDark: {
    backgroundColor: "#111113",
    borderColor: "#2c2c30",
  },
  chatAvatarLight: {
    backgroundColor: "#faf9f7",
    borderColor: "#e6e4e0",
  },
  chatBody: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
    paddingTop: 2,
  },
  chatLead: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.55,
  },
  inlineDemo: {
    display: "inline-flex",
    gap: 8,
    alignItems: "center",
    fontSize: 13,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
    gap: 14,
  },
  card: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
    paddingBlock: 16,
    paddingInline: 16,
    color: "inherit",
    textAlign: "left",
    cursor: "pointer",
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 16,
    transform: {
      default: null,
      ":active": "scale(0.985)",
    },
    transition: `transform 160ms ${motion.easeOut}, border-color 150ms ease, box-shadow 150ms ease`,
  },
  cardSelected: {
    borderColor: "#ff4b64",
    boxShadow: "0 0 0 1px rgba(255, 75, 100, 0.35)",
  },
  cardTop: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
  },
  stateName: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 13,
    fontWeight: 600,
  },
  selectedBadge: {
    paddingBlock: 2,
    paddingInline: 8,
    fontSize: 11,
    fontWeight: 600,
    color: "#ffffff",
    backgroundImage: "linear-gradient(135deg, #ff6b2b, #ff1e7a)",
    borderRadius: 9999,
  },
  stage: {
    display: "grid",
    placeItems: "center",
    width: "100%",
    height: 92,
  },
  sizeStrip: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 8,
    width: "100%",
    paddingBlock: 10,
    paddingInline: 8,
    borderRadius: 12,
  },
  sizeStripDark: {
    backgroundColor: "#111113",
  },
  sizeStripLight: {
    backgroundColor: "#f7f5f2",
  },
  sizeItem: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  sizeOrbSlot: {
    display: "grid",
    placeItems: "center",
    height: 64,
  },
  sizeLabel: {
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
  },
  cardDesc: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
  },
});
