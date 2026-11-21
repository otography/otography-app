import type { z } from "zod";
import type { postViewOutput } from "./schemas.ts";

export type PostView = z.output<typeof postViewOutput>;

/** ローカルのダミー検索で、検索中 UI を確認するための待機時間（ミリ秒）。 */
const LOCAL_SIMILAR_DELAY_MS = 1500;

/** ローカルの DB（turso dev や file:）を指す URL かを判定する。 */
export function isLocalDatabaseUrl(url: string | undefined): boolean {
  if (!url) {
    return false;
  }
  return url.startsWith("file:") || /^https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\/?$/.test(url);
}

/** ローカル環境で、埋め込み検索の代わりにダミーの 3 曲を返すかを判定する。 */
export function isLocalSimilarSimulationEnabled(): boolean {
  return isLocalDatabaseUrl(process.env.TURSO_DATABASE_URL);
}

const DAY_MS = 24 * 60 * 60 * 1000;

const OFFICIAL_AUTHOR = {
  publicId: "otography",
  name: "otography",
  image: "/otography-icon.png",
} as const;

// packages/db/data/official-reviews.json（staging に投入している公式アカウントの実データ）から抜粋。
function buildDummySimilarPosts(now: number): Array<PostView> {
  return [
    {
      id: "jigkxm58kgdj",
      content:
        "名古屋ライブ2日目の「まだ世に出してない新曲、やっちゃっていいんですか！？」というikuraちゃんの煽りが、まさかそのまま歌詞の一文だった衝撃！さらにAyase×ツミキのタッグによる緩急の効いた踊れるサウンドが最高に気持ちよく、何度でも聴き返したくなる痺れる一曲。",
      likeCount: 12,
      createdAt: new Date(now - 1 * DAY_MS),
      author: { ...OFFICIAL_AUTHOR },
      song: {
        isrc: "JPP302600795",
        appleSongId: "6831510081",
        title: "KILLA",
        artistName: "YOASOBI",
        albumName: "KILLA - Single",
        durationMs: 184_584,
        artworkUrl:
          "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/ee/6d/6e/ee6d6e99-ffc6-d4b6-9b20-58dc7a092072/711641064473.jpg/{w}x{h}bb.jpg",
        url: "https://music.apple.com/jp/album/killa/6831510043?i=6831510081",
      },
      likedByMe: false,
    },
    {
      id: "bclda6gokov5",
      content:
        "光を求めて深い水圧の中から水面へと必死にもがく切実でドラマチックな歌詞の世界観に心を奪われつつ、Stray Kidsらしい力強さとユーモアが同居したサウンドに、聴くたびに気持ちが明るく引き上げられる最高に心地よい一曲。",
      likeCount: 8,
      createdAt: new Date(now - 2 * DAY_MS),
      author: { ...OFFICIAL_AUTHOR },
      song: {
        isrc: "JPU902604213",
        appleSongId: "6829772605",
        title: "SUIATSU",
        artistName: "Stray Kids",
        albumName: "SUIATSU",
        durationMs: 169_360,
        artworkUrl:
          "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/e9/ea/13/e9ea1310-a7c2-cc23-aa8a-7a9bfce24ee0/4547366864731.jpg/{w}x{h}bb.jpg",
        url: "https://music.apple.com/jp/album/suiatsu/6829772542?i=6829772605",
      },
      likedByMe: false,
    },
    {
      id: "ctmy1iurjzt3",
      content:
        "買い換えでメモリを失っても微笑む旧型ミクの切ない考察と、「メモリ」というタイトルで過去とのサヨナラを歌う歌詞が完璧にリンク！データ移行に失敗してもなお起動して笑顔を見せる姿に、過去にとらわれず新しく踏み出そうという温かいメッセージを感じて胸が熱くなる名曲。",
      likeCount: 5,
      createdAt: new Date(now - 3 * DAY_MS),
      author: { ...OFFICIAL_AUTHOR },
      song: {
        isrc: "JP92Q2601730",
        appleSongId: "6828710388",
        title: "メモリ",
        artistName: "東京真中 & 初音ミク",
        albumName: "メモリ - Single",
        durationMs: 137_654,
        artworkUrl:
          "https://is1-ssl.mzstatic.com/image/thumb/Music221/v4/7a/b6/54/7ab65434-d4b1-75b3-4f0d-db73506296c7/4511820-61987.jpg/{w}x{h}bb.jpg",
        url: "https://music.apple.com/jp/album/%E3%83%A1%E3%83%A2%E3%83%AA/6828710387?i=6828710388",
      },
      likedByMe: false,
    },
  ];
}

/**
 * ローカル開発用に、埋め込み検索をせずに数秒待ってからダミーの 3 曲を返す。
 * 検索中のローディング表示と結果カードの表示を、Workers AI や変換データ無しで試せるようにする。
 */
export async function simulateLocalSimilarPosts({
  delayMs = LOCAL_SIMILAR_DELAY_MS,
}: {
  delayMs?: number;
} = {}): Promise<Array<PostView>> {
  if (delayMs > 0) {
    await new Promise<void>((resolve) => {
      setTimeout(resolve, delayMs);
    });
  }
  return buildDummySimilarPosts(Date.now());
}
