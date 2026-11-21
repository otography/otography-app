import { create, props } from "@stylexjs/stylex";
import { Button } from "@ui-sdk/react/button";
import { useEffect, useRef, useState } from "react";
import type { PointerEvent } from "react";
import { motion } from "#/motion.stylex";
import { useDraftAssist } from "./DraftAssistContext";
import { CloseIcon } from "./icons";
import { chatMedia, chatPopover, chatTokens as t } from "./tokens.stylex";

const DISMISS_DISTANCE_PX = 36;
const DISMISS_VELOCITY_PX_PER_MS = 0.45;
const RUBBER_BAND_FACTOR = 0.2;

const resetCardInlineStyle = (el: HTMLDivElement) => {
  el.style.transform = "";
  el.style.opacity = "";
  el.style.transition = "";
};

export function ChatDraftAssist() {
  const { state, actions } = useDraftAssist();
  const { activePopup, visible } = state;
  const cardRef = useRef<HTMLDivElement | null>(null);
  const [entered, setEntered] = useState(false);

  const dragRef = useRef<{
    pointerId: number;
    startY: number;
    lastY: number;
    lastTime: number;
    velocityY: number;
  } | null>(null);

  const shouldEnter = Boolean(activePopup && visible);

  // マウント直後に 1 フレーム遅らせて進入トランジションを走らせる。
  useEffect(() => {
    if (!shouldEnter) {
      return;
    }
    const rafId = requestAnimationFrame(() => setEntered(true));
    return () => {
      cancelAnimationFrame(rafId);
      setEntered(false);
    };
  }, [shouldEnter]);

  if (!activePopup) {
    return null;
  }

  const isShown = visible && entered;

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) {
      return;
    }
    // 閉じるボタンのタップ操作はドラッグとして奪わない。
    if (event.target instanceof Element && event.target.closest("button")) {
      return;
    }

    const el = cardRef.current;
    if (!el) {
      return;
    }

    el.setPointerCapture(event.pointerId);
    el.style.transition = "none";
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      lastY: event.clientY,
      lastTime: event.timeStamp,
      velocityY: 0,
    };
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const el = cardRef.current;
    if (!drag || !el || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaY = event.clientY - drag.startY;
    const dt = Math.max(1, event.timeStamp - drag.lastTime);
    drag.velocityY = (event.clientY - drag.lastY) / dt;
    drag.lastY = event.clientY;
    drag.lastTime = event.timeStamp;

    const offsetY = deltaY >= 0 ? deltaY : deltaY * RUBBER_BAND_FACTOR;
    const progress = Math.min(1, Math.max(0, offsetY / (DISMISS_DISTANCE_PX * 2)));
    el.style.transform = `translateY(${offsetY}px)`;
    el.style.opacity = String(1 - progress * 0.65);
  };

  const finishDrag = (event: PointerEvent<HTMLDivElement>, cancelled: boolean) => {
    const drag = dragRef.current;
    const el = cardRef.current;
    if (!drag || !el || drag.pointerId !== event.pointerId) {
      return;
    }

    dragRef.current = null;
    if (el.hasPointerCapture(event.pointerId)) {
      el.releasePointerCapture(event.pointerId);
    }

    const deltaY = event.clientY - drag.startY;
    const shouldDismiss =
      !cancelled &&
      (deltaY >= DISMISS_DISTANCE_PX ||
        (deltaY > 12 && drag.velocityY >= DISMISS_VELOCITY_PX_PER_MS));

    if (shouldDismiss) {
      resetCardInlineStyle(el);
      actions.dismiss("swipe");
      return;
    }

    el.style.transition = `transform 160ms ${motion.easeOut}, opacity 160ms ${motion.easeOut}`;
    el.style.transform = "translateY(0px)";
    el.style.opacity = "1";
    window.setTimeout(() => {
      if (cardRef.current === el) {
        resetCardInlineStyle(el);
      }
    }, 170);
  };

  return (
    <div
      ref={cardRef}
      role="status"
      aria-live="polite"
      data-draft-assist={activePopup.id}
      data-open={isShown ? "" : undefined}
      {...props(styles.card, isShown ? styles.cardVisible : styles.cardHidden)}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={(event) => finishDrag(event, false)}
      onPointerCancel={(event) => finishDrag(event, true)}
    >
      <div {...props(styles.header)}>
        <p {...props(styles.message)}>{activePopup.item.text}</p>
        <Button
          type="button"
          {...props(styles.closeBtn)}
          aria-label="ヒントを閉じる"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => actions.dismiss("button")}
        >
          <CloseIcon />
        </Button>
      </div>
    </div>
  );
}

const styles = create({
  card: {
    position: "absolute",
    bottom: `calc(100% + ${chatPopover.sideOffset}px)`,
    left: 0,
    zIndex: 40,
    display: "flex",
    flexDirection: "column",
    gap: 8,
    width: {
      default: "min(460px, calc(100vw - 32px))",
      [chatMedia.compact]: "100%",
    },
    paddingBlock: {
      default: 10,
      [chatMedia.compact]: 9,
    },
    paddingInline: {
      default: 14,
      [chatMedia.compact]: 12,
    },
    color: t.text,
    touchAction: "pan-x",
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: {
      default: 14,
      [chatMedia.compact]: 12,
    },
    boxShadow: t.shadow,
    transformOrigin: "left bottom",
    transition: {
      default: `opacity 160ms ${motion.easeOut}, transform 180ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "opacity 120ms ease",
    },
  },
  cardHidden: {
    pointerEvents: "none",
    opacity: 0,
    transform: {
      default: "translateY(6px) scale(0.97)",
      [chatMedia.reducedMotion]: "none",
    },
  },
  cardVisible: {
    pointerEvents: "auto",
    opacity: 1,
    transform: {
      default: "translateY(0) scale(1)",
      [chatMedia.reducedMotion]: "none",
    },
  },
  header: {
    display: "flex",
    gap: 8,
    alignItems: "flex-start",
    justifyContent: "space-between",
  },
  message: {
    paddingTop: 2,
    margin: 0,
    fontSize: {
      default: 13,
      [chatMedia.compact]: 12.5,
    },
    lineHeight: 1.5,
    color: t.text,
  },
  closeBtn: {
    position: "relative",
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 26,
    height: 26,
    padding: 0,
    marginTop: -2,
    marginRight: -4,
    color: {
      default: t.muted,
      ":hover": {
        default: t.muted,
        [chatMedia.hover]: t.text,
      },
    },
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
    transform: {
      default: null,
      ":active": {
        default: "scale(0.95)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 150ms ${motion.easeOut}, background-color 140ms ${motion.easeOut}, color 140ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "background-color 120ms ease, color 120ms ease",
    },
    "::before": {
      position: "absolute",
      inset: -9,
      content: '""',
    },
  },
});
