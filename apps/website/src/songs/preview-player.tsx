import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { findSongIdByIsrc, getLoadedMusicKit, getMusicKit } from "#/lib/musickit";
import type { AppleSong, MusicKitInstance } from "#/lib/musickit";

export type PlayerMode = "preview" | "full";
export type PlaybackStatus = "idle" | "loading" | "playing" | "paused";

type PreviewPlayerContextValue = {
  state: {
    activeSong: AppleSong | null;
    mode: PlayerMode | null;
    status: PlaybackStatus;
    currentTime: number;
    duration: number;
    /** プレビュー再生中の曲 ID（PreviewToggle 用） */
    playingId: string | null;
    isAppleMusicAuthorized: boolean;
    isAuthorizingAppleMusic: boolean;
    error: string | null;
  };
  actions: {
    toggle: (song: AppleSong) => void;
    playFull: (song: AppleSong) => Promise<void>;
    togglePlayPause: () => void;
    seek: (timeSec: number) => void;
    close: () => void;
    preloadAppleMusic: () => void;
    authorizeAppleMusic: () => Promise<boolean>;
    unauthorizeAppleMusic: () => Promise<void>;
  };
};

const PreviewPlayerContext = createContext<PreviewPlayerContextValue | null>(null);

function mapPlaybackState(state: number | undefined): PlaybackStatus {
  const states = window.MusicKit?.PlaybackStates;
  if (state === undefined) {
    return "idle";
  }
  if (states) {
    if (state === states.playing) {
      return "playing";
    }
    if (state === states.loading || state === states.waiting || state === states.stalled) {
      return "loading";
    }
    if (state === states.paused) {
      return "paused";
    }
    if (state === states.stopped || state === states.ended || state === states.completed) {
      return "paused";
    }
    return "idle";
  }
  // PlaybackStates 定数が取れない場合のフォールバック（v3 の数値定義）
  if (state === 2) {
    return "playing";
  }
  if (state === 1 || state === 8 || state === 9) {
    return "loading";
  }
  if (state === 3 || state === 4 || state === 5 || state === 10) {
    return "paused";
  }
  return "idle";
}

/**
 * 30 秒試聴（<audio>）と Apple Music フル再生（MusicKit JS）を統合管理する。
 * 試聴は Safari の自動再生制限を避けるため同期的に audio.play() を呼ぶ。
 * 片方を再生するときはもう片方を止めて音が重ならないようにする。
 */
export function PreviewPlayerProvider({ children }: { children: ReactNode }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const boundMusicRef = useRef<MusicKitInstance | null>(null);
  const modeRef = useRef<PlayerMode | null>(null);

  const [activeSong, setActiveSong] = useState<AppleSong | null>(null);
  const [mode, setMode] = useState<PlayerMode | null>(null);
  const [status, setStatus] = useState<PlaybackStatus>("idle");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [isAppleMusicAuthorized, setIsAppleMusicAuthorized] = useState(false);
  const [isAuthorizingAppleMusic, setIsAuthorizingAppleMusic] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateMode = useCallback((next: PlayerMode | null) => {
    modeRef.current = next;
    setMode(next);
  }, []);

  const bindMusicKitEvents = useCallback((music: MusicKitInstance) => {
    if (boundMusicRef.current === music) {
      return;
    }
    boundMusicRef.current = music;
    setIsAppleMusicAuthorized(Boolean(music.isAuthorized));

    const onAuthChange = () => {
      setIsAppleMusicAuthorized(Boolean(music.isAuthorized));
    };
    const onStateChange = (event: unknown) => {
      if (modeRef.current !== "full") {
        return;
      }
      if (music.isPlaying) {
        setStatus("playing");
        return;
      }
      const eventState =
        typeof event === "object" &&
        event !== null &&
        "state" in event &&
        typeof event.state === "number"
          ? event.state
          : undefined;
      const nextState = eventState ?? music.playbackState;
      setStatus(mapPlaybackState(nextState));
    };
    const onTimeChange = (event: unknown) => {
      if (modeRef.current !== "full") {
        return;
      }
      const eventTime =
        typeof event === "object" &&
        event !== null &&
        "currentPlaybackTime" in event &&
        typeof event.currentPlaybackTime === "number"
          ? event.currentPlaybackTime
          : undefined;
      const eventDuration =
        typeof event === "object" &&
        event !== null &&
        "currentPlaybackDuration" in event &&
        typeof event.currentPlaybackDuration === "number"
          ? event.currentPlaybackDuration
          : undefined;
      const nextTime = eventTime ?? music.currentPlaybackTime;
      const nextDuration = eventDuration ?? music.currentPlaybackDuration;
      if (typeof nextTime === "number" && Number.isFinite(nextTime)) {
        setCurrentTime(nextTime);
      }
      if (typeof nextDuration === "number" && Number.isFinite(nextDuration) && nextDuration > 0) {
        setDuration(nextDuration);
      }
    };
    const onPlaybackError = () => {
      if (modeRef.current !== "full") {
        return;
      }
      setStatus("paused");
      setError("フル再生できませんでした。Apple Music の有料プランに加入しているかご確認ください");
    };

    music.addEventListener("authorizationStatusDidChange", onAuthChange);
    music.addEventListener("playbackStateDidChange", onStateChange);
    music.addEventListener("playbackTimeDidChange", onTimeChange);
    music.addEventListener("mediaPlaybackError", onPlaybackError);
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      try {
        boundMusicRef.current?.stop();
      } catch {
        // MusicKit が未再生のまま stop() で例外を出すことがあるため無視する
      }
    };
  }, []);

  const preloadAppleMusic = useCallback(() => {
    const existing = getLoadedMusicKit();
    if (existing) {
      bindMusicKitEvents(existing);
      return;
    }
    void getMusicKit()
      .then((music) => {
        bindMusicKitEvents(music);
      })
      .catch(() => {
        // 事前読み込みの失敗は黙って無視し、実際の操作時に再試行する
      });
  }, [bindMusicKitEvents]);

  const stopPreviewAudio = useCallback(() => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
    }
    setPlayingId(null);
  }, []);

  const pauseFullMusic = useCallback(() => {
    const music = getLoadedMusicKit() ?? boundMusicRef.current;
    if (!music) {
      return;
    }
    try {
      music.pause();
    } catch {
      // 未キュー状態での pause は無視する
    }
  }, []);

  const toggle = useCallback(
    (song: AppleSong) => {
      let audio = audioRef.current;
      if (!audio) {
        audio = new Audio();
        audioRef.current = audio;
      }

      if (modeRef.current === "preview" && playingId === song.id) {
        audio.pause();
        setPlayingId(null);
        setStatus("paused");
        return;
      }

      const url = song.attributes.previews?.[0]?.url;
      if (!url) {
        setError("この曲には試聴がありません");
        return;
      }

      if (modeRef.current === "full") {
        pauseFullMusic();
      }

      audio.src = url;
      audio.ontimeupdate = () => {
        if (modeRef.current !== "preview") {
          return;
        }
        setCurrentTime(audio.currentTime || 0);
      };
      audio.onloadedmetadata = () => {
        if (modeRef.current !== "preview") {
          return;
        }
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
          setDuration(audio.duration);
        }
      };
      audio.onended = () => {
        if (modeRef.current !== "preview") {
          return;
        }
        setPlayingId(null);
        setStatus("paused");
      };

      setError(null);
      setActiveSong(song);
      updateMode("preview");
      setCurrentTime(0);
      setDuration(30);
      setStatus("playing");
      setPlayingId(song.id);

      audio.play().catch(() => {
        setPlayingId(null);
        setStatus("paused");
        setError("試聴を再生できませんでした");
      });
    },
    [pauseFullMusic, playingId, updateMode],
  );

  const authorizeAppleMusic = useCallback(async () => {
    setError(null);
    setIsAuthorizingAppleMusic(true);
    try {
      // Safari のポップアップブロックを避けるため、読み込み済みなら await なしで authorize() を呼ぶ
      const loaded = getLoadedMusicKit();
      const music = loaded ?? (await getMusicKit());
      bindMusicKitEvents(music);
      if (!music.isAuthorized) {
        await music.authorize();
      }
      const authorized = Boolean(music.isAuthorized);
      setIsAppleMusicAuthorized(authorized);
      return authorized;
    } catch {
      setError("Apple Music と連携できませんでした");
      return false;
    } finally {
      setIsAuthorizingAppleMusic(false);
    }
  }, [bindMusicKitEvents]);

  const unauthorizeAppleMusic = useCallback(async () => {
    setError(null);
    const music = getLoadedMusicKit() ?? boundMusicRef.current;
    if (!music) {
      setIsAppleMusicAuthorized(false);
      return;
    }
    try {
      if (modeRef.current === "full") {
        try {
          music.stop();
        } catch {
          // ignore
        }
        setActiveSong(null);
        updateMode(null);
        setStatus("idle");
        setCurrentTime(0);
        setDuration(0);
      }
      await music.unauthorize();
      setIsAppleMusicAuthorized(false);
    } catch {
      setError("Apple Music の連携を解除できませんでした");
    }
  }, [updateMode]);

  const playFull = useCallback(
    async (song: AppleSong) => {
      stopPreviewAudio();
      setError(null);
      setActiveSong(song);
      updateMode("full");
      setCurrentTime(0);
      setDuration(song.attributes.durationInMillis ? song.attributes.durationInMillis / 1000 : 0);
      setStatus("loading");

      try {
        // Safari でユーザージェスチャーを維持するため、初期化済みなら同期的に呼び出す
        const loaded = getLoadedMusicKit();
        const music = loaded ?? (await getMusicKit());
        bindMusicKitEvents(music);

        let justAuthorized = false;
        if (!music.isAuthorized) {
          setIsAuthorizingAppleMusic(true);
          try {
            await music.authorize();
            justAuthorized = true;
          } finally {
            setIsAuthorizingAppleMusic(false);
          }
          setIsAppleMusicAuthorized(Boolean(music.isAuthorized));
          if (!music.isAuthorized) {
            updateMode("preview");
            setStatus("paused");
            return;
          }
        }

        const queueSong = async (id: string) => {
          await music.setQueue({ song: id, startPlaying: !justAuthorized });
          if (!music.isPlaying && mapPlaybackState(music.playbackState) !== "playing") {
            await music.play();
          }
        };

        try {
          await queueSong(song.id);
        } catch (queueError: unknown) {
          const isrc = song.attributes.isrc;
          if (isrc && music.storefrontId && music.storefrontId !== "jp") {
            const altId = await findSongIdByIsrc(music, isrc);
            if (altId) {
              await queueSong(altId);
            } else {
              throw queueError;
            }
          } else {
            throw queueError;
          }
        }

        if (music.queueIsEmpty || music.queue?.items?.length === 0) {
          setStatus("paused");
          setError("この曲は Apple Music でフル再生できませんでした");
          return;
        }

        const nextStatus = music.isPlaying ? "playing" : mapPlaybackState(music.playbackState);
        setStatus(nextStatus === "loading" || nextStatus === "idle" ? "paused" : nextStatus);
        if (
          typeof music.currentPlaybackDuration === "number" &&
          music.currentPlaybackDuration > 0
        ) {
          setDuration(music.currentPlaybackDuration);
        }
      } catch (error_: unknown) {
        setStatus("paused");
        const isNotAllowed =
          error_ instanceof DOMException
            ? error_.name === "NotAllowedError"
            : error_ instanceof Error && /NotAllowed|autoplay|user gesture/i.test(error_.message);
        if (isNotAllowed) {
          setError("再生ボタンを押してフル再生を開始してください");
        } else {
          setError(
            "フル再生できませんでした。Apple Music の有料プランに加入しているかご確認ください",
          );
        }
      }
    },
    [bindMusicKitEvents, stopPreviewAudio, updateMode],
  );

  const togglePlayPause = useCallback(() => {
    if (!activeSong || !modeRef.current) {
      return;
    }

    if (modeRef.current === "preview") {
      const audio = audioRef.current;
      if (!audio) {
        return;
      }
      if (status === "playing") {
        audio.pause();
        setPlayingId(null);
        setStatus("paused");
      } else {
        setError(null);
        setPlayingId(activeSong.id);
        setStatus("playing");
        audio.play().catch(() => {
          setPlayingId(null);
          setStatus("paused");
          setError("試聴を再生できませんでした");
        });
      }
      return;
    }

    const music = getLoadedMusicKit() ?? boundMusicRef.current;
    if (!music) {
      void playFull(activeSong);
      return;
    }
    if (status === "playing" || music.isPlaying) {
      music.pause();
      setStatus("paused");
    } else {
      setError(null);
      setStatus("loading");
      // クリックイベント内で同期的に play() を呼び、失敗したらキュー再設定でリトライする
      void music
        .play()
        .then(() => {
          setStatus(music.isPlaying ? "playing" : "paused");
        })
        .catch(() => playFull(activeSong));
    }
  }, [activeSong, playFull, status]);

  const seek = useCallback((timeSec: number) => {
    const clamped = Math.max(0, timeSec);
    setCurrentTime(clamped);

    if (modeRef.current === "preview") {
      if (audioRef.current) {
        audioRef.current.currentTime = clamped;
      }
      return;
    }

    const music = getLoadedMusicKit() ?? boundMusicRef.current;
    if (music) {
      void music.seekToTime(clamped).catch(() => {
        // シーク失敗時は再生状態を維持する
      });
    }
  }, []);

  const close = useCallback(() => {
    stopPreviewAudio();
    const music = getLoadedMusicKit() ?? boundMusicRef.current;
    if (music) {
      try {
        music.stop();
      } catch {
        // ignore
      }
    }
    setActiveSong(null);
    updateMode(null);
    setStatus("idle");
    setCurrentTime(0);
    setDuration(0);
    setError(null);
  }, [stopPreviewAudio, updateMode]);

  const actions = useMemo(
    () => ({
      toggle,
      playFull,
      togglePlayPause,
      seek,
      close,
      preloadAppleMusic,
      authorizeAppleMusic,
      unauthorizeAppleMusic,
    }),
    [
      toggle,
      playFull,
      togglePlayPause,
      seek,
      close,
      preloadAppleMusic,
      authorizeAppleMusic,
      unauthorizeAppleMusic,
    ],
  );

  return (
    <PreviewPlayerContext
      value={{
        state: {
          activeSong,
          mode,
          status,
          currentTime,
          duration,
          playingId,
          isAppleMusicAuthorized,
          isAuthorizingAppleMusic,
          error,
        },
        actions,
      }}
    >
      {children}
    </PreviewPlayerContext>
  );
}

export function usePreviewPlayer() {
  const value = use(PreviewPlayerContext);
  if (!value) {
    throw new Error("usePreviewPlayer は PreviewPlayerProvider の中で使う");
  }
  return value;
}
