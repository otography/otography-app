import { create, props } from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { Button } from "@ui-sdk/react/button";
import {
  Slider,
  SliderControl,
  SliderIndicator,
  SliderThumb,
  SliderTrack,
} from "@ui-sdk/react/slider";
import { CloseIcon, MusicNoteIcon, PauseIcon, PlayIcon } from "#/chat/icons";
import { chatMedia, chatTokens as t } from "#/chat/tokens.stylex";
import { artworkUrl } from "#/lib/musickit";
import { motion } from "#/motion.stylex";
import { usePreviewPlayer } from "./preview-player";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "0:00";
  }
  const total = Math.floor(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function MiniPlayerBar({ style }: { style?: StyleXStyles }) {
  const { state, actions } = usePreviewPlayer();
  const { activeSong, mode, status, currentTime, duration, isAuthorizingAppleMusic, error } = state;

  if (!activeSong || !mode) {
    return null;
  }

  const isPlaying = status === "playing";
  const isLoading = status === "loading";
  const maxDuration = duration > 0 ? duration : mode === "preview" ? 30 : 1;
  const clampedTime = Math.min(currentTime, maxDuration);

  return (
    <section aria-label="再生中の曲" data-mini-player="" {...props(styles.bar, style)}>
      <div {...props(styles.row)}>
        <div {...props(styles.songInfo)}>
          {activeSong.attributes.artwork ? (
            <img
              src={artworkUrl(activeSong.attributes.artwork.url, 64)}
              alt=""
              width={32}
              height={32}
              {...props(styles.artwork)}
            />
          ) : (
            <div {...props(styles.artwork, styles.artFallback)} aria-hidden="true">
              <MusicNoteIcon />
            </div>
          )}

          <div {...props(styles.meta)}>
            <div {...props(styles.titleLine)}>
              <span {...props(styles.title)}>{activeSong.attributes.name}</span>
              <span {...props(styles.badge, mode === "full" && styles.badgeFull)}>
                {mode === "full" ? "Apple Music" : "30秒試聴"}
              </span>
            </div>
            <span {...props(styles.artist)}>{activeSong.attributes.artistName}</span>
          </div>
        </div>

        <div {...props(styles.controls)}>
          <Button
            type="button"
            aria-label={isPlaying ? "一時停止" : "再生"}
            onClick={actions.togglePlayPause}
            {...props(styles.playBtn)}
          >
            {isPlaying ? <PauseIcon /> : <PlayIcon />}
          </Button>

          <div {...props(styles.seekGroup)}>
            <span {...props(styles.time)}>{formatTime(clampedTime)}</span>
            <Slider
              value={clampedTime}
              min={0}
              max={maxDuration}
              step={1}
              disabled={isLoading || duration <= 0}
              onValueChange={(value) => actions.seek(value)}
              {...props(styles.slider)}
            >
              <SliderControl {...props(styles.sliderControl)}>
                <SliderTrack {...props(styles.sliderTrack)}>
                  <SliderIndicator {...props(styles.sliderIndicator)} />
                  <SliderThumb aria-label="再生位置" {...props(styles.sliderThumb)} />
                </SliderTrack>
              </SliderControl>
            </Slider>
            <span {...props(styles.time)}>{duration > 0 ? formatTime(duration) : "--:--"}</span>
          </div>
        </div>

        <div {...props(styles.actions)}>
          {mode === "preview" ? (
            <Button
              type="button"
              disabled={isAuthorizingAppleMusic}
              onClick={() => void actions.playFull(activeSong)}
              {...props(styles.fullBtn)}
            >
              {isAuthorizingAppleMusic ? "連携中…" : "フルで聴く"}
            </Button>
          ) : null}

          <Button
            type="button"
            aria-label="プレイヤーを閉じる"
            onClick={actions.close}
            {...props(styles.closeBtn)}
          >
            <CloseIcon />
          </Button>
        </div>
      </div>

      {error ? (
        <p role="alert" {...props(styles.error)}>
          {error}
        </p>
      ) : null}
    </section>
  );
}

const styles = create({
  bar: {
    zIndex: 9,
    display: "flex",
    flexShrink: 0,
    flexDirection: "column",
    gap: 6,
    paddingTop: 8,
    paddingRight: {
      default: "max(20px, env(safe-area-inset-right, 0px))",
      [chatMedia.compact]: "max(12px, env(safe-area-inset-right, 0px))",
    },
    paddingBottom: 8,
    paddingLeft: {
      default: "max(20px, env(safe-area-inset-left, 0px))",
      [chatMedia.compact]: "max(12px, env(safe-area-inset-left, 0px))",
    },
    backgroundColor: `color-mix(in srgb, ${t.surface} 92%, transparent)`,
    borderBottomColor: t.border,
    borderBottomStyle: "solid",
    borderBottomWidth: 1,
    backdropFilter: "blur(10px)",
  },
  row: {
    display: "flex",
    flexWrap: {
      default: "nowrap",
      [chatMedia.compact]: "wrap",
    },
    gap: {
      default: 14,
      [chatMedia.compact]: 8,
    },
    alignItems: "center",
    justifyContent: "space-between",
    width: "min(100%, 960px)",
    marginInline: "auto",
  },
  songInfo: {
    display: "flex",
    flexGrow: {
      default: 0,
      [chatMedia.compact]: 1,
    },
    flexShrink: 1,
    gap: 10,
    alignItems: "center",
    minWidth: 0,
    maxWidth: {
      default: 260,
      [chatMedia.compact]: "calc(100% - 140px)",
    },
  },
  artwork: {
    display: "block",
    flexShrink: 0,
    width: 32,
    height: 32,
    objectFit: "cover",
    borderRadius: 6,
  },
  artFallback: {
    display: "grid",
    placeItems: "center",
    color: t.muted,
    backgroundColor: t.hover,
  },
  meta: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    minWidth: 0,
  },
  titleLine: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    minWidth: 0,
  },
  title: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 12,
    fontWeight: 600,
    color: t.text,
    whiteSpace: "nowrap",
  },
  badge: {
    flexShrink: 0,
    paddingBlock: 1,
    paddingInline: 5,
    fontSize: 10,
    fontWeight: 500,
    color: t.muted,
    backgroundColor: t.hover,
    borderRadius: 4,
  },
  badgeFull: {
    color: t.primaryFg,
    backgroundColor: t.primary,
  },
  artist: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 11,
    color: t.muted,
    whiteSpace: "nowrap",
  },
  controls: {
    display: "flex",
    flexGrow: 1,
    flexShrink: 1,
    gap: 10,
    alignItems: "center",
    order: {
      default: 0,
      [chatMedia.compact]: 3,
    },
    minWidth: {
      default: 180,
      [chatMedia.compact]: "100%",
    },
  },
  playBtn: {
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 28,
    height: 28,
    padding: 0,
    color: t.primaryFg,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    backgroundColor: t.primary,
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 9999,
    opacity: {
      default: 1,
      ":disabled": 0.5,
    },
    transform: {
      default: null,
      ":active": {
        default: "scale(0.95)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 140ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "none",
    },
  },
  seekGroup: {
    display: "flex",
    flexGrow: 1,
    gap: 8,
    alignItems: "center",
    minWidth: 0,
  },
  time: {
    flexShrink: 0,
    fontSize: 11,
    fontVariantNumeric: "tabular-nums",
    color: t.muted,
  },
  slider: {
    flexGrow: 1,
    minWidth: 60,
  },
  sliderControl: {
    display: "flex",
    alignItems: "center",
    width: "100%",
    height: 20,
    touchAction: "none",
    cursor: "pointer",
  },
  sliderTrack: {
    position: "relative",
    width: "100%",
    height: 4,
    backgroundColor: t.border,
    borderRadius: 9999,
  },
  sliderIndicator: {
    position: "absolute",
    top: 0,
    bottom: 0,
    backgroundColor: t.primary,
    borderRadius: 9999,
  },
  sliderThumb: {
    position: "absolute",
    top: "50%",
    width: 12,
    height: 12,
    backgroundColor: t.primary,
    borderColor: t.bg,
    borderStyle: "solid",
    borderWidth: 2,
    borderRadius: 9999,
    transform: "translate(-50%, -50%)",
  },
  actions: {
    display: "flex",
    flexShrink: 0,
    gap: 6,
    alignItems: "center",
  },
  fullBtn: {
    height: 28,
    paddingBlock: 0,
    paddingInline: 10,
    fontSize: 12,
    fontWeight: 600,
    color: t.primaryFg,
    whiteSpace: "nowrap",
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    backgroundColor: t.primary,
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 8,
    opacity: {
      default: 1,
      ":disabled": 0.5,
    },
    transform: {
      default: null,
      ":active": {
        default: "scale(0.97)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 150ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "none",
    },
  },
  closeBtn: {
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 28,
    height: 28,
    padding: 0,
    color: t.muted,
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": {
        default: "transparent",
        [chatMedia.hover]: t.hover,
      },
    },
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 9999,
  },
  error: {
    width: "min(100%, 960px)",
    marginBlock: 0,
    marginInline: "auto",
    fontSize: 12,
    color: t.danger,
  },
});
