import { fetchCatalogSong } from "./catalog.ts";
import { getDeveloperToken } from "./token.ts";

/** Worker 用の開発者トークンで、Apple Music のカタログから曲を 1 つ取得する。 */
export async function fetchSong(songId: string) {
  const token = await getDeveloperToken({ origin: null });
  if (token instanceof Error) return token;
  return fetchCatalogSong({ songId, developerToken: token.token });
}
