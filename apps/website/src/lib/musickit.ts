import { queryOptions } from "@tanstack/react-query";
import { client } from "#/lib/api";

// MusicKit on the Web（v3）のうち、この画面で使う部分だけの型。
// https://js-cdn.music.apple.com/musickit/v3/docs/

/** Apple Music API のカタログのリソース（曲、アーティストなど）。 */
type CatalogResource<Attributes> = { id: string; attributes: Attributes };

/** Apple Music API のジャケット画像と代表色（# なしの 6 桁 16 進数）。 */
export type AppleArtwork = {
  url: string;
  bgColor?: string;
  textColor1?: string;
  textColor2?: string;
  textColor3?: string;
  textColor4?: string;
};

/** Apple Music API のカタログの曲（使う属性だけ）。 */
export type AppleSong = CatalogResource<{
  name: string;
  artistName: string;
  albumName?: string;
  artwork?: AppleArtwork;
  durationInMillis?: number;
  isrc?: string;
  url?: string;
  /** 試聴用の音源（約 30 秒）。 */
  previews?: { url: string }[];
}>;

/** Apple Music API のカタログのアーティスト（使う属性だけ）。 */
export type AppleArtist = CatalogResource<{
  name: string;
  artwork?: AppleArtwork;
  genreNames?: string[];
}>;

export type MusicKitPlaybackTimeEvent = {
  currentPlaybackTime?: number;
  currentPlaybackDuration?: number;
};

export type MusicKitPlaybackStateEvent = {
  state?: number;
};

export type MusicKitInstance = {
  isAuthorized: boolean;
  isPlaying?: boolean;
  queueIsEmpty?: boolean;
  queue?: { items?: unknown[]; isEmpty?: boolean };
  storefrontId?: string;
  playbackState?: number;
  currentPlaybackTime?: number;
  currentPlaybackDuration?: number;
  authorize: () => Promise<string | undefined>;
  unauthorize: () => Promise<void>;
  setQueue: (options: { song: string; startPlaying?: boolean }) => Promise<unknown>;
  play: () => Promise<void>;
  pause: () => void;
  stop: () => void;
  seekToTime: (time: number) => Promise<void>;
  addEventListener: (event: string, listener: (event: unknown) => void) => void;
  removeEventListener: (event: string, listener: (event: unknown) => void) => void;
  api: {
    music: <T>(path: string, query?: Record<string, string | number>) => Promise<{ data: T }>;
  };
};

declare global {
  interface Window {
    MusicKit?: {
      PlaybackStates?: {
        none: number;
        loading: number;
        playing: number;
        paused: number;
        stopped: number;
        ended: number;
        seeking: number;
        waiting: number;
        stalled: number;
        completed: number;
      };
      configure: (options: {
        developerToken: string;
        app: { name: string; build: string };
      }) => Promise<MusicKitInstance>;
    };
  }
}

const SCRIPT_URL = "https://js-cdn.music.apple.com/musickit/v3/musickit.js";

const LOAD_TIMEOUT_MS = 15_000;

/**
 * 開発サーバーでは、Vite が define の値（TanStack Router のプラグインが足す process.env.TSS_INLINE_CSS_ENABLED）を
 * globalThis.process に置く。musickit.js は初期読み込み時だけでなく configure() や setQueue() で
 * プレイヤーのモジュールを遅延ロードするときも process があると Node.js 環境だと誤認し、
 * 再生機能が初期化されない。本番ビルドでは process は置かれないため、開発時のみ削除したままにする。
 */
function removeViteProcessShim() {
  const scope = globalThis as { process?: unknown };
  if (!import.meta.env.DEV || scope.process === undefined) return;
  delete scope.process;
}

/**
 * musickit.js を読み込む。MusicKit の準備ができると document に musickitloaded が発火する。
 * 発火しないまま待ち続けないよう、一定の時間で失敗にする。
 */
const loadScript = () =>
  new Promise<void>((resolve, reject) => {
    removeViteProcessShim();
    if (typeof window.MusicKit?.configure === "function") return resolve();
    const timer = setTimeout(() => {
      reject(new Error("MusicKit の準備ができませんでした。再読み込みしてください"));
    }, LOAD_TIMEOUT_MS);
    document.addEventListener(
      "musickitloaded",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
    const script = document.createElement("script");
    script.src = SCRIPT_URL;
    script.async = true;
    // CDN は CORS を許可している。crossOrigin を付けると、スクリプト内の例外の内容がコンソールに出る。
    script.crossOrigin = "anonymous";
    script.onerror = () => {
      clearTimeout(timer);
      reject(new Error("MusicKit を読み込めませんでした"));
    };
    document.head.append(script);
  });

let instance: Promise<MusicKitInstance> | null = null;
let loadedInstance: MusicKitInstance | null = null;

/** すでに初期化済みの MusicKit を同期的に返す。Safari でクリック直後に呼ぶために使う。 */
export function getLoadedMusicKit() {
  return loadedInstance;
}

/**
 * 設定済みの MusicKit を返す。開発者トークンは API から受け取る（このページのオリジンでだけ使える）。
 * ページを開いている間は同じインスタンスを使う。
 */
export function getMusicKit() {
  instance ??= (async () => {
    const res = await client.api.music.token.$get();
    if (!res.ok) throw new Error("Apple Music を使う準備ができませんでした");
    const { token } = await res.json();
    await loadScript();
    if (!window.MusicKit) throw new Error("MusicKit を読み込めませんでした");
    const configured = await window.MusicKit.configure({
      developerToken: token,
      app: { name: "otography", build: "0.0.0" },
    });
    loadedInstance = configured;
    return configured;
  })().catch((error: unknown) => {
    instance = null;
    loadedInstance = null;
    throw error;
  });
  return instance;
}

/** ユーザーのストアフロントが異なる場合に ISRC から再生可能な曲 ID を引き直す。 */
export async function findSongIdByIsrc(music: MusicKitInstance, isrc: string) {
  const storefront = music.storefrontId || "jp";
  const { data } = await music.api.music<{ data?: { id: string }[] }>(
    `/v1/catalog/${storefront}/songs`,
    { "filter[isrc]": isrc },
  );
  return data.data?.[0]?.id ?? null;
}

/** 検索の種類と、返るリソースの型。 */
type SearchTypes = { songs: AppleSong; artists: AppleArtist };
type SearchResults = { [Type in keyof SearchTypes]?: { data: SearchTypes[Type][] } };

/** カタログを 1 つの種類で検索する。ストアフロントは jp に固定する（API と同じ）。 */
async function searchCatalog<Type extends keyof SearchTypes>(term: string, type: Type) {
  const music = await getMusicKit();
  const { data } = await music.api.music<{ results: SearchResults }>("/v1/catalog/jp/search", {
    term,
    types: type,
    limit: 10,
    l: "ja",
  });
  const results: SearchResults = data.results;
  return results[type]?.data ?? [];
}

/** 曲を検索する。 */
export const searchSongs = (term: string) => searchCatalog(term, "songs");

/** アーティストを検索する。 */
export const searchArtists = (term: string) => searchCatalog(term, "artists");

/** カタログの曲を Apple Music の ID でまとめて取得する。 */
async function fetchSongsByIds(ids: string[]): Promise<AppleSong[]> {
  if (ids.length === 0) return [];
  const music = await getMusicKit();
  const { data } = await music.api.music<{ data?: AppleSong[] }>("/v1/catalog/jp/songs", {
    ids: ids.join(","),
    l: "ja",
  });
  return data.data ?? [];
}

/** Apple Music の ID の一覧から、試聴 URL を含む曲の情報をまとめて取得するクエリ。 */
export const catalogSongsQuery = (ids: string[]) => {
  const normalizedIds = Array.from(new Set(ids.filter(Boolean))).sort();
  return queryOptions({
    queryKey: ["musickit", "songs", normalizedIds],
    queryFn: () => fetchSongsByIds(normalizedIds),
    enabled: normalizedIds.length > 0,
    staleTime: 10 * 60 * 1000,
    retry: false,
  });
};

/** ジャケット画像の URL のテンプレート（{w}x{h}）に大きさを入れる。 */
export const artworkUrl = (template: string, size: number) =>
  template.replace("{w}", String(size)).replace("{h}", String(size));
