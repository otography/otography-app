import { fetchSong } from "./client";

// Apple Music API レスポンスからDB挿入値を構築
export const toSongInput = (apiResponse: Awaited<ReturnType<typeof fetchSong>>) => {
  if (apiResponse instanceof Error) return apiResponse;

  const { attributes, relationships } = apiResponse;
  const artistEntries =
    relationships?.artists?.data?.map((a) => ({
      appleMusicId: a.id,
      name: a.attributes?.name ?? "",
    })) ?? [];

  return {
    songValues: {
      title: attributes.name,
      appleMusicId: apiResponse.id,
      length:
        attributes.durationInMillis != null ? Math.round(attributes.durationInMillis / 1000) : null,
      isrcs: attributes.isrc ?? null,
    },
    genreNames: attributes.genreNames,
    artistEntries,
  };
};
