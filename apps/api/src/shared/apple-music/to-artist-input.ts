import { fetchArtist } from "./client";

export type ArtistInput = Exclude<ReturnType<typeof toArtistInput>, Error>;

// Apple Music API レスポンスからドメイン入力値を構築
export const toArtistInput = (apiResponse: Awaited<ReturnType<typeof fetchArtist>>) => {
  if (apiResponse instanceof Error) return apiResponse;

  return {
    name: apiResponse.attributes.name,
    appleMusicId: apiResponse.id,
  };
};
