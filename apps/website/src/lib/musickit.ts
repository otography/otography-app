import { client } from "#/lib/api";

// MusicKit on the Web（v3）のうち、この画面で使う部分だけの型。
// https://js-cdn.music.apple.com/musickit/v3/docs/

/** Apple Music API のカタログの曲（使う属性だけ）。 */
export type AppleSong = {
  id: string;
  attributes: {
    name: string;
    artistName: string;
    albumName?: string;
    artwork?: { url: string };
    isrc?: string;
    /** 試聴用の音源（約 30 秒）。 */
    previews?: { url: string }[];
  };
};

type MusicKitInstance = {
  api: {
    music: <T>(path: string, query?: Record<string, string | number>) => Promise<{ data: T }>;
  };
};

declare global {
  interface Window {
    MusicKit?: {
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
 * globalThis.process に置く。musickit.js は process があると Node.js の環境だと判断して、読み込みの途中で例外になる。
 * そのため、開発時だけ、読み込みの間は globalThis.process を外し、読み込み後に戻す。本番のビルドでは process は置かれない。
 */
function hideViteProcessShim() {
  const scope = globalThis as { process?: unknown };
  if (!import.meta.env.DEV || scope.process === undefined) return () => {};
  const saved = scope.process;
  delete scope.process;
  return () => {
    scope.process = saved;
  };
}

/**
 * musickit.js を読み込む。MusicKit の準備ができると document に musickitloaded が発火する。
 * 発火しないまま待ち続けないよう、一定の時間で失敗にする。
 */
const loadScript = () =>
  new Promise<void>((resolve, reject) => {
    if (typeof window.MusicKit?.configure === "function") return resolve();
    const restoreProcess = hideViteProcessShim();
    const timer = setTimeout(() => {
      restoreProcess();
      reject(new Error("MusicKit の準備ができませんでした。再読み込みしてください"));
    }, LOAD_TIMEOUT_MS);
    document.addEventListener(
      "musickitloaded",
      () => {
        clearTimeout(timer);
        restoreProcess();
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
      restoreProcess();
      reject(new Error("MusicKit を読み込めませんでした"));
    };
    document.head.append(script);
  });

let instance: Promise<MusicKitInstance> | null = null;

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
    return window.MusicKit.configure({
      developerToken: token,
      app: { name: "otography", build: "0.0.0" },
    });
  })().catch((error: unknown) => {
    instance = null;
    throw error;
  });
  return instance;
}

/** 曲を検索する。ストアフロントは jp に固定する（API と同じ）。 */
export async function searchSongs(term: string) {
  const music = await getMusicKit();
  const { data } = await music.api.music<{ results: { songs?: { data: AppleSong[] } } }>(
    "/v1/catalog/jp/search",
    { term, types: "songs", limit: 10, l: "ja" },
  );
  return data.results.songs?.data ?? [];
}

/** ジャケット画像の URL のテンプレート（{w}x{h}）に大きさを入れる。 */
export const artworkUrl = (template: string, size: number) =>
  template.replace("{w}", String(size)).replace("{h}", String(size));
