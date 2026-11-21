import { create, props } from "@stylexjs/stylex";
import { Button } from "@ui-sdk/react/button";
import { motion } from "#/motion.stylex";
import { useChat } from "./ChatContext";
import { EMPTY_HINT_ANGLES } from "./draft-assist-copy";
import { useDraftAssist } from "./DraftAssistContext";
import { chatMedia, chatTokens as t } from "./tokens.stylex";

export function ChatEmptyHints() {
  const { state: chatState } = useChat();
  const { state, actions } = useDraftAssist();

  if (!chatState.selectedSong || chatState.menuOpen) {
    return null;
  }

  return (
    <div
      role="group"
      aria-label="書き出しの観点ヒント"
      aria-hidden={!state.showEmptyHints}
      {...props(styles.hintBar, !state.showEmptyHints && styles.hintBarHidden)}
    >
      {EMPTY_HINT_ANGLES.map((angle) => {
        const selected = state.selectedAngle === angle.id;
        return (
          <Button
            key={angle.id}
            type="button"
            aria-pressed={selected}
            tabIndex={state.showEmptyHints ? 0 : -1}
            {...props(styles.hintChip, selected && styles.hintChipSelected)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => actions.selectEmptyHintAngle(angle.id)}
          >
            {angle.label}
          </Button>
        );
      })}
    </div>
  );
}

const styles = create({
  hintBar: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    alignItems: "center",
    minHeight: 28,
    opacity: 1,
    transition: {
      default: `opacity 150ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "opacity 120ms ease",
    },
  },
  hintBarHidden: {
    display: {
      default: "flex",
      [chatMedia.compact]: "none",
    },
    pointerEvents: "none",
    opacity: 0,
  },
  hintChip: {
    display: "inline-flex",
    alignItems: "center",
    height: 26,
    paddingBlock: 0,
    paddingInline: 10,
    fontFamily: "inherit",
    fontSize: 12,
    fontWeight: 500,
    color: t.muted,
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": {
        default: "transparent",
        [chatMedia.hover]: t.hover,
      },
      ":active": t.hover,
    },
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9999,
    transform: {
      default: null,
      ":active": {
        default: "scale(0.97)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 150ms ${motion.easeOut}, background-color 140ms ${motion.easeOut}, color 140ms ${motion.easeOut}, border-color 140ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]:
        "background-color 120ms ease, color 120ms ease, border-color 120ms ease",
    },
  },
  hintChipSelected: {
    color: t.text,
    backgroundColor: t.hover,
    borderColor: t.borderStrong,
  },
});
