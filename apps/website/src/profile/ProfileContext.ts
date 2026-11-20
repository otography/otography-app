import { createContext, use } from "react";
import type { Me } from "#/lib/auth";
import type { AppleArtist, AppleSong } from "#/lib/musickit";
import type { PostView } from "#/lib/posts";
import type {
  FavoriteArtistItem,
  FavoriteDecoration,
  FavoriteSongItem,
  ProfileView,
} from "#/lib/profile";

type ProfileState = {
  user: Me;
  profile: ProfileView | null;
  isProfilePending: boolean;
  profileError: string | null;
  posts: PostView[];
  isPostsPending: boolean;
  postsError: string | null;
  hasNextPosts: boolean;
  isFetchingNextPosts: boolean;
  favoriteSongs: FavoriteSongItem[];
  favoriteArtists: FavoriteArtistItem[];
  catalogSongs: {
    byId: Map<string, AppleSong>;
    byIsrc: Map<string, AppleSong>;
  };
  isUpdatingProfile: boolean;
  isSavingSongs: boolean;
  isSavingArtists: boolean;
  deletingPostId: string | null;
  likingPostId: string | null;
};

type ProfileActions = {
  updateProfile: (input: { name: string; bio: string }) => Promise<void>;
  addFavoriteSong: (song: AppleSong, decoration: FavoriteDecoration) => Promise<void>;
  updateFavoriteSong: (isrc: string, decoration: FavoriteDecoration) => Promise<void>;
  removeFavoriteSong: (isrc: string) => Promise<void>;
  moveFavoriteSong: (index: number, direction: -1 | 1) => Promise<void>;
  addFavoriteArtist: (artist: AppleArtist, decoration: FavoriteDecoration) => Promise<void>;
  updateFavoriteArtist: (artistId: string, decoration: FavoriteDecoration) => Promise<void>;
  removeFavoriteArtist: (artistId: string) => Promise<void>;
  moveFavoriteArtist: (index: number, direction: -1 | 1) => Promise<void>;
  deletePost: (postId: string) => Promise<void>;
  toggleLike: (postId: string, liked: boolean) => Promise<void>;
  fetchMorePosts: () => void;
};

type ProfileMeta = {
  favoriteLimit: number;
  favoriteCommentMax: number;
  userNameMax: number;
  userBioMax: number;
};

export type ProfileContextValue = {
  state: ProfileState;
  actions: ProfileActions;
  meta: ProfileMeta;
};

export const ProfileContext = createContext<ProfileContextValue | null>(null);

export function useProfile() {
  const value = use(ProfileContext);
  if (!value) throw new Error("useProfile は ProfileProvider の中で使う");
  return value;
}
