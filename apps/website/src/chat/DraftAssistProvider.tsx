import { useCallback, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { requestDraftAssist, sendDraftAssistEvent } from "#/lib/draft-assist";
import type { AssistPopupId, EmptyHintAngle, MessageAngle } from "#/lib/draft-assist";
import { useChat } from "./ChatContext";
import { pickAssistMessage, pickEmptyPlaceholder } from "./draft-assist-copy";
import { DraftAssistContext } from "./DraftAssistContext";
import type { ActiveAssistPopup } from "./DraftAssistContext";

const MAX_ASSIST_SHOWN = 2;
const MIN_EVAL_TEXT_LENGTH = 6;
const MAX_EVAL_TEXT_LENGTH = 120;
const API_DEBOUNCE_MS = 2500;
const FADE_OUT_MS = 160;

interface SessionState {
  id: string;
  shownCount: number;
  shownPopupIds: Set<AssistPopupId>;
  lastEvaluatedText: string;
  lastShownPopupId: AssistPopupId | null;
  lastMessageAngle: MessageAngle | null;
  charCountAtLastShown: number | null;
  submitted: boolean;
  abandonedLogged: boolean;
}

function createSession(): SessionState {
  return {
    id: crypto.randomUUID(),
    shownCount: 0,
    shownPopupIds: new Set(),
    lastEvaluatedText: "",
    lastShownPopupId: null,
    lastMessageAngle: null,
    charCountAtLastShown: null,
    submitted: false,
    abandonedLogged: false,
  };
}

export function DraftAssistProvider({ children }: { children: ReactNode }) {
  const { state: chatState, meta: chatMeta } = useChat();
  const { selectedSong, draft, menuOpen, isComposing, lastSubmission } = chatState;

  const [activePopup, setActivePopup] = useState<ActiveAssistPopup | null>(null);
  const [visible, setVisible] = useState(false);
  const [selectedAngle, setSelectedAngle] = useState<EmptyHintAngle | null>(null);
  const [placeholderText, setPlaceholderText] = useState<string>(() => pickEmptyPlaceholder(null));

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
    if (
      session.submitted ||
      session.abandonedLogged ||
      session.shownCount === 0 ||
      !session.lastShownPopupId ||
      !session.lastMessageAngle
    ) {
      return;
    }
    session.abandonedLogged = true;
    sendDraftAssistEvent(
      {
        event: "draft_abandoned",
        draftSessionId: session.id,
        lastShownPopupId: session.lastShownPopupId,
        lastMessageAngle: session.lastMessageAngle,
        shownCount: session.shownCount,
        shownPopupIds: Array.from(session.shownPopupIds),
      },
      { keepalive },
    );
  }, []);

  const showPopup = useCallback(
    (popupId: AssistPopupId, charCountAtShown: number, modelVersion?: string) => {
      const session = sessionRef.current;
      if (session.shownCount >= MAX_ASSIST_SHOWN) {
        return;
      }
      if (session.shownPopupIds.has(popupId)) {
        return;
      }

      clearFadeTimer();
      const picked = pickAssistMessage(popupId);
      session.shownCount += 1;
      session.shownPopupIds.add(popupId);
      session.lastShownPopupId = popupId;
      session.lastMessageAngle = picked.item.angle;
      session.charCountAtLastShown = charCountAtShown;

      setActivePopup({
        id: popupId,
        messageIndex: picked.index,
        item: picked.item,
      });
      setVisible(true);

      sendDraftAssistEvent({
        event: "assist_shown",
        draftSessionId: session.id,
        popupId,
        messageIndex: picked.index,
        messageAngle: picked.item.angle,
        charCountAtShown,
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
        finalCharCount: lastSubmission.length,
        appendedAfterAssist:
          session.charCountAtLastShown !== null &&
          lastSubmission.length > session.charCountAtLastShown,
        shownCount: session.shownCount,
        shownPopupIds: Array.from(session.shownPopupIds),
      });
    }
    abortInFlight();
    hideImmediately();
  }, [abortInFlight, hideImmediately, lastSubmission]);

  // 曲の選択・変更・解除に合わせて投稿セッションと白紙プレースホルダーを初期化する。
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
    setSelectedAngle(null);
    setPlaceholderText((prev) => pickEmptyPlaceholder(null, prev));
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

    if (draftChanged || isComposing || menuOpen) {
      abortInFlight();
      if (visible) {
        fadeOutPopup();
      }
    }
  }, [abortInFlight, draft, fadeOutPopup, isComposing, menuOpen, visible]);

  // 記述後フェーズ（6〜120 文字）の 2,500 ms デバウンス付き API 評価。0〜5 文字では発火しない。
  useEffect(() => {
    if (!selectedSong || menuOpen || isComposing) {
      return;
    }

    const session = sessionRef.current;
    if (session.shownCount >= MAX_ASSIST_SHOWN) {
      return;
    }

    const trimmedLength = draft.trim().length;
    if (trimmedLength < MIN_EVAL_TEXT_LENGTH || trimmedLength > MAX_EVAL_TEXT_LENGTH) {
      return;
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
          messageAngle: activePopup.item.angle,
          method,
        });
      }
      hideImmediately();
    },
    [activePopup, hideImmediately],
  );

  const selectEmptyHintAngle = useCallback(
    (angle: EmptyHintAngle) => {
      setSelectedAngle(angle);
      setPlaceholderText((prev) => pickEmptyPlaceholder(angle, prev));
      sendDraftAssistEvent({
        event: "empty_hint_tapped",
        draftSessionId: sessionRef.current.id,
        angle,
      });
      chatMeta.textareaRef.current?.focus();
    },
    [chatMeta.textareaRef],
  );

  const showEmptyHints = selectedSong !== null && !menuOpen && draft.length === 0;

  return (
    <DraftAssistContext
      value={{
        state: {
          activePopup,
          visible,
          selectedAngle,
          placeholderText,
          showEmptyHints,
        },
        actions: {
          dismiss,
          selectEmptyHintAngle,
        },
      }}
    >
      {children}
    </DraftAssistContext>
  );
}
