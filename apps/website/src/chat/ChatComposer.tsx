import { create, keyframes, props } from "@stylexjs/stylex";
import { Button } from "@ui-sdk/react/button";
import { useLayoutEffect, useRef } from "react";
import type { KeyboardEvent, ReactNode } from "react";
import { artworkUrl } from "#/lib/musickit";
import { useMediaQuery } from "#/lib/use-media-query";
import { motion } from "#/motion.stylex";
import { PreviewToggle } from "#/songs/PreviewToggle";
import { useChat } from "./ChatContext";
import { ChatDraftAssist } from "./ChatDraftAssist";
import { ChatSongPicker } from "./ChatSongPicker";
import { ArrowUpIcon, CloseIcon, MusicNoteIcon, PlusIcon } from "./icons";
import { chatMedia, chatTokens as t } from "./tokens.stylex";

/** 入力欄の外枠。キーボード表示中は余白を詰める。中に他の部品を並べる。 */
function Frame({ children }: { children: ReactNode }) {
  const { state, actions, meta } = useChat();

  return (
    <div {...props(styles.dock, state.keyboardOpen && styles.dockKeyboardOpen)}>
      <form
        ref={meta.composerRef}
        data-chat-composer=""
        {...props(styles.composer)}
        onSubmit={(event) => {
          event.preventDefault();
          actions.submit();
        }}
      >
        {children}
      </form>
    </div>
  );
}

/** 選択中の曲のチップ。曲が選ばれていなければ何も描画しない。 */
function Attachment() {
  const { state, actions } = useChat();
  const song = state.selectedSong;
  if (!song) {
    return null;
  }
  const { name, artistName, artwork } = song.attributes;

  return (
    <div {...props(styles.attachment)}>
      {artwork ? (
        <img
          {...props(styles.attachmentArt)}
          src={artworkUrl(artwork.url, 80)}
          alt=""
          width={36}
          height={36}
        />
      ) : (
        <div {...props(styles.attachmentArt, styles.artFallback)} aria-hidden="true">
          <MusicNoteIcon />
        </div>
      )}
      <div {...props(styles.attachmentMeta)}>
        <span {...props(styles.attachmentTitle)}>{name}</span>
        <span {...props(styles.attachmentArtist)}>{artistName}</span>
      </div>
      <PreviewToggle song={song} title={name} style={styles.iconBtn} />
      <Button
        type="button"
        {...props(styles.iconBtn)}
        aria-label={`${name} の選択を解除`}
        onClick={actions.clearSong}
      >
        <CloseIcon />
      </Button>
    </div>
  );
}

const copy = {
  full: {
    label: "曲への感想を入力（@ または / で曲を検索）",
    withSong: "この曲への感想を書く…（Enter で送信、Shift+Enter で改行）",
    withoutSong: "@ または / に続けて曲名・アーティスト名で検索し、感想を書く…",
  },
  compact: {
    label: "曲への感想を入力",
    withSong: "この曲への感想を書く…",
    withoutSong: "曲を選んで感想を書く…",
  },
};

/** 感想の入力欄。曲検索メニューが開いている間は、候補の移動・確定のキー操作も受け持つ。 */
function Input() {
  const { state, actions, meta } = useChat();
  const compact = useMediaQuery("(max-width: 540px)");
  const coarsePointer = useMediaQuery("(pointer: coarse)");
  const isMobile = compact || coarsePointer;
  const text = compact ? copy.compact : copy.full;
  const { menuOpen, songs, highlightedIndex, keyboardOpen } = state;
  const isComposingRef = useRef(false);
  const compositionEndedAtRef = useRef(0);

  // Safari では compositionend が keydown(Enter) より先に発火するため、直後の Enter も変換確定として扱う。
  const isImeComposing = (event: KeyboardEvent<HTMLTextAreaElement>) =>
    event.nativeEvent.isComposing ||
    isComposingRef.current ||
    event.keyCode === 229 ||
    event.key === "Process" ||
    performance.now() - compositionEndedAtRef.current < 50;

  // 1行以内はコンパクトな minHeight のまま保ち、2行目以降で maxHeight まで自動で広げる。
  useLayoutEffect(() => {
    const el = meta.textareaRef.current;
    if (!el) {
      return;
    }
    if (!state.draft) {
      el.style.height = "";
      el.style.overflowY = "hidden";
      return;
    }

    el.style.height = "0px";
    const computed = window.getComputedStyle(el);
    const minHeight = Number.parseFloat(computed.minHeight) || 30;
    const computedMax = Number.parseFloat(computed.maxHeight);
    const maxHeight = Number.isFinite(computedMax) ? computedMax : 200;

    if (el.scrollHeight <= minHeight + 2) {
      el.style.height = "";
      el.style.overflowY = "hidden";
      return;
    }

    const nextHeight = Math.min(el.scrollHeight, maxHeight);
    el.style.height = `${nextHeight}px`;
    el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [meta.textareaRef, state.draft, state.selectedSong, keyboardOpen, compact]);

  return (
    <textarea
      ref={meta.textareaRef}
      {...props(styles.textarea)}
      aria-label={text.label}
      aria-controls={menuOpen ? meta.pickerId : undefined}
      enterKeyHint={menuOpen ? "search" : isMobile ? "enter" : "send"}
      placeholder={state.selectedSong ? text.withSong : text.withoutSong}
      rows={1}
      value={state.draft}
      onFocus={() => {
        if (!state.selectedSong && !menuOpen) {
          actions.openSongSearch("@");
        }
      }}
      onCompositionStart={() => {
        isComposingRef.current = true;
        actions.setComposing(true);
      }}
      onCompositionEnd={() => {
        isComposingRef.current = false;
        compositionEndedAtRef.current = performance.now();
        actions.setComposing(false);
      }}
      onChange={(event) => actions.updateDraft(event.currentTarget.value)}
      onKeyDown={(event) => {
        if (menuOpen) {
          if (event.key === "Escape") {
            event.preventDefault();
            actions.dismissSongSearch();
            return;
          }
          if (event.key === "ArrowDown" && songs.length > 0) {
            event.preventDefault();
            actions.moveHighlight(1);
            return;
          }
          if (event.key === "ArrowUp" && songs.length > 0) {
            event.preventDefault();
            actions.moveHighlight(-1);
            return;
          }
          if (
            (event.key === "Enter" || event.key === "Tab") &&
            !event.shiftKey &&
            !isImeComposing(event) &&
            songs.length > 0
          ) {
            const target = songs[highlightedIndex];
            if (target?.attributes.isrc) {
              event.preventDefault();
              actions.selectSong(target);
            }
            return;
          }
        }

        if (
          !isMobile &&
          event.key === "Enter" &&
          !event.shiftKey &&
          !isImeComposing(event) &&
          !menuOpen
        ) {
          event.preventDefault();
          actions.submit();
        }
      }}
    />
  );
}

function Toolbar({ children }: { children: ReactNode }) {
  return <div {...props(styles.toolbar)}>{children}</div>;
}

function PickSongButton() {
  const { actions } = useChat();

  return (
    <div {...props(styles.tools)}>
      <Button
        type="button"
        {...props(styles.toolBtn)}
        aria-label="曲を検索して添付"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => actions.openSongSearch("@")}
      >
        <PlusIcon />
        <span>曲を選ぶ</span>
      </Button>
    </div>
  );
}

/** 文字数カウンターと送信ボタン。 */
function Submit() {
  const { state, meta } = useChat();
  const overLimit = state.length > meta.maxLength;

  return (
    <div {...props(styles.submitGroup)}>
      <span {...props(styles.counter, overLimit && styles.counterOver)}>
        {state.length} / {meta.maxLength}
      </span>
      <Button
        type="submit"
        {...props(styles.sendBtn, state.canSubmit && styles.sendBtnEnabled)}
        aria-label="感想を送信"
        disabled={!state.canSubmit}
      >
        <ArrowUpIcon />
      </Button>
    </div>
  );
}

/**
 * チャットの入力欄。使う側が部品を並べて組み立てる。
 *
 * <ChatComposer.Frame>
 *   <ChatComposer.SongPicker />
 *   <ChatComposer.Attachment />
 *   <ChatComposer.Input />
 *   <ChatComposer.Toolbar>
 *     <ChatComposer.PickSongButton />
 *     <ChatComposer.Submit />
 *   </ChatComposer.Toolbar>
 * </ChatComposer.Frame>
 */
export const ChatComposer = {
  Frame,
  DraftAssist: ChatDraftAssist,
  SongPicker: ChatSongPicker,
  Attachment,
  Input,
  Toolbar,
  PickSongButton,
  Submit,
};

const chipEnter = keyframes({
  from: {
    opacity: 0,
    transform: "scale(0.96) translateY(4px)",
  },
  to: {
    opacity: 1,
    transform: "scale(1) translateY(0)",
  },
});

const fadeIn = keyframes({
  from: { opacity: 0 },
  to: { opacity: 1 },
});

const styles = create({
  dock: {
    position: "relative",
    zIndex: 20,
    flexShrink: 0,
    width: "min(100%, 760px)",
    paddingTop: {
      default: 8,
      [chatMedia.compact]: 4,
    },
    paddingRight: {
      default: "max(16px, env(safe-area-inset-right, 0px))",
      [chatMedia.compact]: "max(12px, env(safe-area-inset-right, 0px))",
    },
    paddingBottom: {
      default: "max(20px, env(safe-area-inset-bottom, 0px))",
      [chatMedia.compact]: "max(12px, env(safe-area-inset-bottom, 0px))",
    },
    paddingLeft: {
      default: "max(16px, env(safe-area-inset-left, 0px))",
      [chatMedia.compact]: "max(12px, env(safe-area-inset-left, 0px))",
    },
    marginBlock: 0,
    marginInline: "auto",
    backgroundImage: `linear-gradient(to bottom, color-mix(in srgb, ${t.bg} 0%, transparent), ${t.bg} 28%)`,
  },
  dockKeyboardOpen: {
    paddingBottom: {
      default: 12,
      [chatMedia.compact]: 8,
    },
  },
  composer: {
    position: "relative",
    display: "flex",
    flexDirection: "column",
    gap: {
      default: 8,
      [chatMedia.compact]: 4,
    },
    paddingTop: {
      default: 12,
      [chatMedia.compact]: 8,
    },
    paddingRight: {
      default: 14,
      [chatMedia.compact]: 10,
    },
    paddingBottom: {
      default: 10,
      [chatMedia.compact]: 8,
    },
    paddingLeft: {
      default: 14,
      [chatMedia.compact]: 12,
    },
    backgroundColor: t.surface,
    borderColor: {
      default: t.border,
      ":focus-within": t.borderStrong,
    },
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: {
      default: 22,
      [chatMedia.compact]: 18,
    },
    boxShadow: t.shadow,
    transition: "border-color 0.15s ease",
  },
  attachment: {
    display: "inline-flex",
    gap: {
      default: 10,
      [chatMedia.compact]: 8,
    },
    alignItems: "center",
    alignSelf: "flex-start",
    maxWidth: "100%",
    paddingBlock: {
      default: 6,
      [chatMedia.compact]: 4,
    },
    paddingInline: {
      default: 8,
      [chatMedia.compact]: 6,
    },
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 12,
    transformOrigin: "left bottom",
    animationName: {
      default: chipEnter,
      [chatMedia.reducedMotion]: fadeIn,
    },
    animationDuration: {
      default: "180ms",
      [chatMedia.reducedMotion]: "120ms",
    },
    animationTimingFunction: {
      default: motion.easeOut,
      [chatMedia.reducedMotion]: "ease",
    },
    animationFillMode: "both",
  },
  attachmentArt: {
    flexShrink: 0,
    width: {
      default: 36,
      [chatMedia.compact]: 30,
    },
    height: {
      default: 36,
      [chatMedia.compact]: 30,
    },
    objectFit: "cover",
    borderRadius: 7,
  },
  attachmentMeta: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    minWidth: 0,
  },
  attachmentTitle: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  attachmentArtist: {
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: 12,
    color: t.muted,
    whiteSpace: "nowrap",
  },
  artFallback: {
    display: "grid",
    placeItems: "center",
    color: t.muted,
    backgroundColor: t.hover,
  },
  iconBtn: {
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 28,
    height: 28,
    padding: 0,
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
        default: "scale(0.97)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 160ms ${motion.easeOut}, background-color 150ms ${motion.easeOut}, color 150ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "background-color 120ms ease, color 120ms ease",
    },
  },
  textarea: {
    width: "100%",
    minHeight: {
      default: 55,
      [chatMedia.compact]: 30,
    },
    maxHeight: {
      default: 200,
      [chatMedia.compact]: 120,
    },
    paddingBlock: {
      default: 4,
      [chatMedia.compact]: 2,
    },
    paddingInline: 2,
    fontFamily: "inherit",
    fontSize: {
      default: 15,
      [chatMedia.touch]: 16,
    },
    lineHeight: {
      default: 1.55,
      [chatMedia.compact]: 1.45,
    },
    color: t.text,
    resize: "none",
    outline: {
      default: "none",
      ":focus-visible": "none",
      ":focus": "none",
    },
    backgroundColor: "transparent",
    borderStyle: "none",
    borderWidth: 0,
    boxShadow: "none",
  },
  toolbar: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    justifyContent: "space-between",
  },
  tools: {
    display: "flex",
    gap: 6,
    alignItems: "center",
  },
  toolBtn: {
    display: "inline-flex",
    gap: {
      default: 6,
      [chatMedia.compact]: 4,
    },
    alignItems: "center",
    height: {
      default: 32,
      [chatMedia.compact]: 30,
    },
    paddingBlock: 0,
    paddingInline: {
      default: 11,
      [chatMedia.compact]: 10,
    },
    fontSize: {
      default: 13,
      [chatMedia.compact]: 12,
    },
    fontWeight: 500,
    color: t.text,
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": {
        default: "transparent",
        [chatMedia.hover]: t.hover,
      },
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
      default: `transform 160ms ${motion.easeOut}, background-color 150ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "background-color 120ms ease",
    },
  },
  submitGroup: {
    display: "flex",
    gap: {
      default: 10,
      [chatMedia.compact]: 8,
    },
    alignItems: "center",
  },
  counter: {
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    color: t.muted,
  },
  counterOver: {
    fontWeight: 600,
    color: t.danger,
  },
  sendBtn: {
    display: "grid",
    placeItems: "center",
    width: {
      default: 34,
      [chatMedia.compact]: 30,
    },
    height: {
      default: 34,
      [chatMedia.compact]: 30,
    },
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
      ":disabled": 0.35,
    },
    transition: {
      default: `opacity 150ms ${motion.easeOut}, transform 160ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "opacity 120ms ease",
    },
  },
  sendBtnEnabled: {
    transform: {
      default: null,
      ":active": {
        default: "scale(0.95)",
        [chatMedia.reducedMotion]: "none",
      },
    },
  },
});
