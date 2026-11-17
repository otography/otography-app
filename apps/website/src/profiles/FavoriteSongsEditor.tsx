import { SongPicker } from "#/songs/SongPicker";
import { useFavorites } from "./editor/context";
import { FavoriteSongsProvider } from "./editor/FavoriteSongsProvider";
import { Favorites } from "./editor/parts";
import type { Profile } from "./queries";

/** お気に入りの曲を編集する。 */
export function FavoriteSongsEditor({ profile }: { profile: Profile }) {
  return (
    <FavoriteSongsProvider profile={profile}>
      <Favorites.Frame>
        <Favorites.Heading />
        <Favorites.List />
        <Favorites.Add>
          <AddSong />
        </Favorites.Add>
        <Favorites.Save />
      </Favorites.Frame>
    </FavoriteSongsProvider>
  );
}

/** 曲を検索して、お気に入りに足す。ISRC のない曲は選べない（SongPicker が選ばせない）。 */
function AddSong() {
  const { actions } = useFavorites();
  return (
    <SongPicker
      onSelect={(song) => {
        const isrc = song.attributes.isrc?.toUpperCase();
        if (!isrc) return;
        actions.add({
          key: isrc,
          target: { songId: song.id, isrc },
          title: song.attributes.name,
          subtitle: song.attributes.artistName,
          artworkUrl: song.attributes.artwork?.url ?? null,
          comment: "",
          emoji: "",
          color: null,
        });
      }}
    />
  );
}
