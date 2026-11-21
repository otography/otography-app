import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { requestDraftAssist, sendDraftAssistEvent } from "#/lib/draft-assist";
import type { AssistPopupId } from "#/lib/draft-assist";
import { useChat } from "./ChatContext";
import { buildDraftWithChip, pickAssistMessage, STALLED_CHIPS } from "./draft-assist-copy";
import type { AssistChip } from "./draft-assist-copy";
import { DraftAssistContext } from "./DraftAssistContext";
import type { ActiveAssistPopup } from "./DraftAssistContext";

const MAX_ASSIST_SHOWN = 2;
const MAX_EVAL_TEXT_LENGTH = 120;
const STALLED_MAX_LENGTH = 5;
const STALLED_DEBOUNCE_MS = 5000;
const API_DEBOUNCE_MS = 2500;
const FADE_OUT_MS = 160;

interface SessionState {
  id: string;
  shownCount: number;
  shownPopupIds: Set<AssistPopupId>;
  lastEvaluatedText: string;
  textLengthAtLastShown: number | null;
  lastTextLength: number;
  submitted: boolean;
  abandonedLogged: boolean;
}

function createSession(): SessionState {
  return {
    id: crypto.randomUUID(),
    shownCount: 0,
    shownPopupIds: new Set(),
    lastEvaluatedText: "",
    textLengthAtLastShown: null,
    lastTextLength: 0,
    submitted: false,
    abandonedLogged: false,
  };
}

export function DraftAssistProvider({ children }: { children: ReactNode }) {
  const { state: chatState, actions: chatActions, meta: chatMeta } = useChat();
  const { selectedSong, draft, menuOpen, isComposing, lastSubmission } = chatState;

  const [activePopup, setActivePopup] = useState<ActiveAssistPopup | null>(null);
  const [visible, setVisible] = useState(false);

  const sessionRef = useRef<SessionState>(createSession());
  const abortRef = useRef<AbortController | null>(null);
  const fadeTimerRef = useRef<number | null>(null);
  const lastSubmissionIdRef = useRef<string | null>(null);
  const prevSongIdRef = useRef<string | null>(null);
  const prevDraftRef = useRef<string>(draft);

  const clearFadeTimer = useCallback(() => {
    if (fadeTimerRef.current !== null) {
      window.clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
  }, []);

  const abortInFlight = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
  }, []);

  const hideImmediately = useCallback(() => {
    clearFadeTimer();
    setVisible(false);
    setActivePopup(null);
  }, [clearFadeTimer]);

  const fadeOutPopup = useCallback(() => {
    setVisible(false);
    clearFadeTimer();
    fadeTimerRef.current = window.setTimeout(() => {
      fadeTimerRef.current = null;
      setActivePopup(null);
    }, FADE_OUT_MS);
  }, [clearFadeTimer]);

  const flushAbandonedIfNeeded = useCallback((keepalive: boolean) => {
    const session = sessionRef.current;
    if (session.submitted || session.abandonedLogged || session.shownCount === 0) {
      return;
    }
    session.abandonedLogged = true;
    sendDraftAssistEvent(
      {
        event: "draft_abandoned",
        draftSessionId: session.id,
        lastTextLength: session.lastTextLength,
        shownCount: session.shownCount,
        shownPopupIds: Array.from(session.shownPopupIds),
      },
      { keepalive },
    );
  }, []);

  const showPopup = useCallback(
    (popupId: AssistPopupId, textLength: number, modelVersion?: string) => {
      const session = sessionRef.current;
      if (session.shownCount >= MAX_ASSIST_SHOWN) {
        return;
      }
      if (session.shownPopupIds.has(popupId)) {
        return;
      }

      clearFadeTimer();
      session.shownCount += 1;
      session.shownPopupIds.add(popupId);
      session.textLengthAtLastShown = textLength;

      const picked = pickAssistMessage(popupId);
      setActivePopup({
        id: popupId,
        message: picked.message,
        chips: popupId === "A_STALLED" ? STALLED_CHIPS : [],
      });
      setVisible(true);

      sendDraftAssistEvent({
        event: "assist_shown",
        draftSessionId: session.id,
        popupId,
        messageIndex: picked.index,
        textLength,
        modelVersion,
      });
    },
    [clearFadeTimer],
  );

  // 投稿完了を検知して draft_submitted を記録する。
  useEffect(() => {
    if (!lastSubmission || lastSubmission.id === lastSubmissionIdRef.current) {
      return;
    }
    lastSubmissionIdRef.current = lastSubmission.id;

    const session = sessionRef.current;
    session.submitted = true;
    if (session.shownCount > 0) {
      sendDraftAssistEvent({
        event: "draft_submitted",
        draftSessionId: session.id,
        finalTextLength: lastSubmission.length,
        appendedAfterAssist:
          session.textLengthAtLastShown !== null &&
          lastSubmission.length > session.textLengthAtLastShown,
        shownCount: session.shownCount,
        shownPopupIds: Array.from(session.shownPopupIds),
      });
    }
    abortInFlight();
    hideImmediately();
  }, [abortInFlight, hideImmediately, lastSubmission]);

  // 曲の選択・変更・解除に合わせて投稿セッションを切り替える。
  useEffect(() => {
    const currentSongId = selectedSong?.id ?? null;
    if (currentSongId === prevSongIdRef.current) {
      return;
    }

    if (prevSongIdRef.current !== null) {
      flushAbandonedIfNeeded(false);
    }

    prevSongIdRef.current = currentSongId;
    abortInFlight();
    hideImmediately();
    sessionRef.current = createSession();
  }, [abortInFlight, flushAbandonedIfNeeded, hideImmediately, selectedSong?.id]);

  // ページ離脱・アンマウント時の draft_abandoned 記録。
  useEffect(() => {
    const handlePageHide = () => flushAbandonedIfNeeded(true);
    window.addEventListener("pagehide", handlePageHide);
    return () => {
      window.removeEventListener("pagehide", handlePageHide);
      flushAbandonedIfNeeded(true);
      abortInFlight();
      clearFadeTimer();
    };
  }, [abortInFlight, clearFadeTimer, flushAbandonedIfNeeded]);

  // 入力再開・IME 変換開始時に進行中のリクエストを破棄し、表示中ポップアップを静かに消去する。
  useEffect(() => {
    const draftChanged = draft !== prevDraftRef.current;
    prevDraftRef.current = draft;
    sessionRef.current.lastTextLength = draft.trim().length;

    if (draftChanged || isComposing || menuOpen) {
      abortInFlight();
      if (visible) {
        fadeOutPopup();
      }
    }
  }, [abortInFlight, draft, fadeOutPopup, isComposing, menuOpen, visible]);

  // デバウンス付きトリガー（A_STALLED のローカル検知、および 6〜120 文字の API 評価）。
  useEffect(() => {
    if (!selectedSong || menuOpen || isComposing) {
      return;
    }

    const session = sessionRef.current;
    if (session.shownCount >= MAX_ASSIST_SHOWN) {
      return;
    }

    const trimmedLength = draft.trim().length;
    if (trimmedLength > MAX_EVAL_TEXT_LENGTH) {
      return;
    }

    if (trimmedLength <= STALLED_MAX_LENGTH) {
      if (session.shownPopupIds.has("A_STALLED")) {
        return;
      }

      const timerId = window.setTimeout(() => {
        showPopup("A_STALLED", trimmedLength);
      }, STALLED_DEBOUNCE_MS);

      return () => window.clearTimeout(timerId);
    }

    if (draft === session.lastEvaluatedText) {
      return;
    }

    const trackTitle = `${selectedSong.attributes.name} - ${selectedSong.attributes.artistName}`;
    const targetSessionId = session.id;
    const targetDraft = draft;

    const timerId = window.setTimeout(() => {
      if (sessionRef.current.id !== targetSessionId) {
        return;
      }
      if (sessionRef.current.shownCount >= MAX_ASSIST_SHOWN) {
        return;
      }

      abortInFlight();
      const controller = new AbortController();
      abortRef.current = controller;
      sessionRef.current.lastEvaluatedText = targetDraft;

      void requestDraftAssist(
        {
          draftSessionId: targetSessionId,
          trackTitle,
          draftText: targetDraft,
        },
        controller.signal,
      ).then((res) => {
        if (controller.signal.aborted) {
          return;
        }
        if (abortRef.current === controller) {
          abortRef.current = null;
        }
        if (sessionRef.current.id !== targetSessionId) {
          return;
        }
        if (!res?.popupId) {
          return;
        }
        showPopup(res.popupId, trimmedLength, res.modelVersion);
      });
    }, API_DEBOUNCE_MS);

    return () => window.clearTimeout(timerId);
  }, [abortInFlight, draft, isComposing, menuOpen, selectedSong, showPopup]);

  const dismiss = useCallback(
    (method: "button" | "swipe") => {
      if (activePopup) {
        sendDraftAssistEvent({
          event: "assist_dismissed",
          draftSessionId: sessionRef.current.id,
          popupId: activePopup.id,
          method,
          textLength: draft.trim().length,
        });
      }
      hideImmediately();
    },
    [activePopup, draft, hideImmediately],
  );

  const applyChip = useCallback(
    (chip: AssistChip) => {
      const nextDraft = buildDraftWithChip(draft, chip.insertText);
      hideImmediately();
      chatActions.updateDraft(nextDraft);
      requestAnimationFrame(() => {
        const el = chatMeta.textareaRef.current;
        if (!el) {
          return;
        }
        el.focus();
        const pos = nextDraft.length;
        el.setSelectionRange(pos, pos);
      });
    },
    [chatActions, chatMeta.textareaRef, draft, hideImmediately],
  );

  return (
    <DraftAssistContext
      value={{
        state: {
          activePopup,
          visible,
        },
        actions: {
          dismiss,
          applyChip,
        },
      }}
    >
      {children}
    </DraftAssistContext>
  );
}
