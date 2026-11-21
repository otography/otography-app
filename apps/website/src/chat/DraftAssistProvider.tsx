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

interface SessionState {
  id: string;
  shownCount: number;
  shownPopupIds: Set<AssistPopupId>;
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
    lastShownPopupId: null,
    lastMessageAngle: null,
    charCountAtLastShown: null,
    submitted: false,
    abandonedLogged: false,
  };
}

export function DraftAssistProvider({ children }: { children: ReactNode }) {
  const { state: chatState, meta: chatMeta } = useChat();
  const { selectedSong, draft, menuOpen, lastSubmission } = chatState;

  const [activePopup, setActivePopup] = useState<ActiveAssistPopup | null>(null);
  const [visible, setVisible] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [shownCount, setShownCount] = useState(0);
  const [selectedAngle, setSelectedAngle] = useState<EmptyHintAngle | null>(null);
  const [placeholderText, setPlaceholderText] = useState<string>(() => pickEmptyPlaceholder(null));

  const sessionRef = useRef<SessionState>(createSession());
  const abortRef = useRef<AbortController | null>(null);
  const lastSubmissionIdRef = useRef<string | null>(null);
  const prevSongIdRef = useRef<string | null>(null);

  const abortInFlight = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort();
      abortRef.current = null;
    }
    setIsLoading(false);
  }, []);

  const hideImmediately = useCallback(() => {
    setVisible(false);
    setActivePopup(null);
  }, []);

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

      const picked = pickAssistMessage(popupId);
      session.shownCount += 1;
      session.shownPopupIds.add(popupId);
      session.lastShownPopupId = popupId;
      session.lastMessageAngle = picked.item.angle;
      session.charCountAtLastShown = charCountAtShown;
      setShownCount(session.shownCount);

      // 既にポップアップが出ている場合も、2回目の結果でそのまま置き換える。
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
    [],
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

  // 曲の選択・変更・解除に合わせて投稿セッションと残り回数・白紙プレースホルダーを初期化する。
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
    setShownCount(0);
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
    };
  }, [abortInFlight, flushAbandonedIfNeeded]);

  // 曲検索メニューが開いたときはポップアップと重なるため隠す。入力再開では閉じず明示的に閉じられるまで残す。
  useEffect(() => {
    if (menuOpen) {
      queueMicrotask(() => {
        abortInFlight();
        hideImmediately();
      });
    }
  }, [abortInFlight, hideImmediately, menuOpen]);

  const requestAssist = useCallback(() => {
    if (!selectedSong || menuOpen || isLoading) {
      return;
    }
    const session = sessionRef.current;
    if (session.shownCount >= MAX_ASSIST_SHOWN) {
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed) {
      return;
    }

    const trackTitle = `${selectedSong.attributes.name} - ${selectedSong.attributes.artistName}`;
    const targetSessionId = session.id;
    const trimmedLength = trimmed.length;

    abortInFlight();
    const controller = new AbortController();
    abortRef.current = controller;
    setIsLoading(true);

    void requestDraftAssist(
      {
        draftSessionId: targetSessionId,
        trackTitle,
        draftText: trimmed,
      },
      controller.signal,
    ).then((res) => {
      if (controller.signal.aborted) {
        return;
      }
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsLoading(false);
      if (sessionRef.current.id !== targetSessionId) {
        return;
      }

      const fallbackId: AssistPopupId =
        trimmedLength < MIN_EVAL_TEXT_LENGTH ? "B_ABSTRACT" : "E_DEEPEN_GENERAL";
      showPopup(res?.popupId ?? fallbackId, trimmedLength, res?.modelVersion);
    });
  }, [abortInFlight, draft, isLoading, menuOpen, selectedSong, showPopup]);

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

  const remainingCount = Math.max(0, MAX_ASSIST_SHOWN - shownCount);
  const canRequestAssist =
    selectedSong !== null &&
    !menuOpen &&
    draft.trim().length > 0 &&
    remainingCount > 0 &&
    !isLoading;

  // 書き出し直後（0〜5文字）の間も観点ヒントバーを残し、6文字以上でフェードアウトする。
  const showEmptyHints =
    selectedSong !== null && !menuOpen && draft.trim().length < MIN_EVAL_TEXT_LENGTH;

  return (
    <DraftAssistContext
      value={{
        state: {
          activePopup,
          visible,
          isLoading,
          remainingCount,
          canRequestAssist,
          selectedAngle,
          placeholderText,
          showEmptyHints,
        },
        actions: {
          requestAssist,
          dismiss,
          selectEmptyHintAngle,
        },
      }}
    >
      {children}
    </DraftAssistContext>
  );
}
