import { ArtistPicker } from "#/artists/ArtistPicker";
import { useFavorites } from "./editor/context";
import { FavoriteArtistsProvider } from "./editor/FavoriteArtistsProvider";
import { Favorites } from "./editor/parts";
import type { Profile } from "./queries";

/** お気に入りのアーティストを編集する。 */
export function FavoriteArtistsEditor({ profile }: { profile: Profile }) {
  return (
    <FavoriteArtistsProvider profile={profile}>
      <Favorites.Frame>
        <Favorites.Heading />
        <Favorites.List />
        <Favorites.Add>
          <AddArtist />
        </Favorites.Add>
        <Favorites.Save />
      </Favorites.Frame>
    </FavoriteArtistsProvider>
  );
}

function AddArtist() {
  const { actions } = useFavorites();
  return (
    <ArtistPicker
      onSelect={(artist) =>
        actions.add({
          key: artist.id,
          target: { artistId: artist.id },
          title: artist.attributes.name,
          subtitle: artist.attributes.genreNames?.join("・") ?? null,
          artworkUrl: artist.attributes.artwork?.url ?? null,
          comment: "",
          emoji: "",
          color: null,
        })
      }
    />
  );
}
