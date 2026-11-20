import * as stylex from "@stylexjs/stylex";
import { Button } from "@ui-sdk/react/button";
import { MusicNoteIcon } from "#/chat/icons";
import { chatMedia, chatTokens as t } from "#/chat/tokens.stylex";
import { motion } from "#/motion.stylex";
import { usePreviewPlayer } from "#/songs/preview-player";

export function AppleMusicConnection() {
  const { state, actions } = usePreviewPlayer();
  const { isAppleMusicAuthorized, isAuthorizingAppleMusic } = state;

  return (
    <section aria-label="Apple Music 連携" {...stylex.props(styles.card)}>
      <div {...stylex.props(styles.info)}>
        <div {...stylex.props(styles.iconWrap)} aria-hidden="true">
          <MusicNoteIcon />
        </div>
        <div {...stylex.props(styles.copy)}>
          <div {...stylex.props(styles.headingRow)}>
            <h2 {...stylex.props(styles.heading)}>Apple Music</h2>
            {isAppleMusicAuthorized ? (
              <span {...stylex.props(styles.statusBadge)}>連携中</span>
            ) : null}
          </div>
          <p {...stylex.props(styles.desc)}>
            {isAppleMusicAuthorized
              ? "試聴バーの「フルで聴く」から曲をフル再生できます。"
              : "有料アカウントを連携すると、試聴した曲をそのままフル再生できます。"}
          </p>
        </div>
      </div>

      {isAppleMusicAuthorized ? (
        <Button
          type="button"
          onClick={() => void actions.unauthorizeAppleMusic()}
          {...stylex.props(styles.secondaryBtn)}
        >
          連携を解除
        </Button>
      ) : (
        <Button
          type="button"
          disabled={isAuthorizingAppleMusic}
          onClick={() => void actions.authorizeAppleMusic()}
          {...stylex.props(styles.primaryBtn)}
        >
          {isAuthorizingAppleMusic ? "連携中…" : "連携する"}
        </Button>
      )}
    </section>
  );
}

const styles = stylex.create({
  card: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "center",
    justifyContent: "space-between",
    paddingBlock: 14,
    paddingInline: {
      default: 20,
      [chatMedia.compact]: 14,
    },
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 16,
  },
  info: {
    display: "flex",
    flexGrow: 1,
    flexShrink: 1,
    gap: 12,
    alignItems: "center",
    minWidth: 0,
  },
  iconWrap: {
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 36,
    height: 36,
    color: t.text,
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 10,
  },
  copy: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  headingRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  heading: {
    margin: 0,
    fontSize: 14,
    fontWeight: 600,
    color: t.text,
  },
  statusBadge: {
    paddingBlock: 1,
    paddingInline: 6,
    fontSize: 11,
    fontWeight: 600,
    color: t.primaryFg,
    backgroundColor: t.primary,
    borderRadius: 9999,
  },
  desc: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    color: t.muted,
  },
  primaryBtn: {
    flexShrink: 0,
    height: 34,
    paddingBlock: 0,
    paddingInline: 14,
    fontSize: 13,
    fontWeight: 600,
    color: t.primaryFg,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    backgroundColor: t.primary,
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 10,
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
      default: `transform 160ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "none",
    },
  },
  secondaryBtn: {
    flexShrink: 0,
    height: 34,
    paddingBlock: 0,
    paddingInline: 12,
    fontSize: 13,
    fontWeight: 500,
    color: t.text,
    cursor: "pointer",
    backgroundColor: {
      default: t.surfaceElevated,
      ":hover": {
        default: t.surfaceElevated,
        [chatMedia.hover]: t.hover,
      },
    },
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 10,
    transform: {
      default: null,
      ":active": {
        default: "scale(0.97)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 160ms ${motion.easeOut}, background-color 150ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "background-color 120ms ease",
    },
  },
});
