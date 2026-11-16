import { type ReactNode, createContext, use, useEffect, useRef, useState } from "react";
import type { AppleSong } from "#/lib/musickit";

type PreviewPlayerContextValue = {
  state: { playingId: string | null; error: string | null };
  actions: { toggle: (song: AppleSong) => void };
};

const PreviewPlayerContext = createContext<PreviewPlayerContextValue | null>(null);

/**
 * 試聴を 1 曲ずつ再生する。Apple Music API の previews の音源を <audio> で再生する。
 * Safari は、ボタンを押した処理の中で同期的に play() を呼ばないと再生を止めるので、
 * 音源の取得を待たずに play() を呼べるこの形にしている。
 * Provider が画面から外れると、再生を止める。
 */
export function PreviewPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const toggle = (song: AppleSong) => {
    const audio = (audioRef.current ??= new Audio());
    if (playingId === song.id) {
      audio.pause();
      setPlayingId(null);
      return;
    }
    const url = song.attributes.previews?.[0]?.url;
    if (!url) {
      setError("この曲には試聴がありません");
      return;
    }
    audio.src = url;
    audio.onended = () => setPlayingId(null);
    setError(null);
    setPlayingId(song.id);
    audio.play().catch((e: unknown) => {
      console.warn("試聴を再生できませんでした", e);
      setPlayingId(null);
      setError("試聴を再生できませんでした");
    });
  };

  return (
    <PreviewPlayerContext value={{ state: { playingId, error }, actions: { toggle } }}>
      {children}
    </PreviewPlayerContext>
  );
}

export function usePreviewPlayer() {
  const value = use(PreviewPlayerContext);
  if (!value) throw new Error("usePreviewPlayer は PreviewPlayerProvider の中で使う");
  return value;
}
