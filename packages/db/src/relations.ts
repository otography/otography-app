import { defineRelations } from "drizzle-orm";
import * as schema from "./schema/index.ts";

export const relations = defineRelations(schema, (r) => ({
  users: {
    sessions: r.many.sessions(),
    accounts: r.many.accounts(),
    posts: r.many.posts(),
    likes: r.many.likes(),
    favoriteSongs: r.many.favoriteSongs(),
    favoriteArtists: r.many.favoriteArtists(),
  },
  sessions: {
    user: r.one.users({ from: r.sessions.userId, to: r.users.id, optional: false }),
  },
  accounts: {
    user: r.one.users({ from: r.accounts.userId, to: r.users.id, optional: false }),
  },
  songs: {
    posts: r.many.posts(),
  },
  favoriteSongs: {
    user: r.one.users({ from: r.favoriteSongs.userId, to: r.users.id, optional: false }),
    song: r.one.songs({ from: r.favoriteSongs.songIsrc, to: r.songs.isrc, optional: false }),
  },
  favoriteArtists: {
    user: r.one.users({ from: r.favoriteArtists.userId, to: r.users.id, optional: false }),
    artist: r.one.artists({ from: r.favoriteArtists.artistId, to: r.artists.id, optional: false }),
  },
  posts: {
    author: r.one.users({ from: r.posts.userId, to: r.users.id, optional: false }),
    song: r.one.songs({ from: r.posts.songIsrc, to: r.songs.isrc }),
    likes: r.many.likes(),
    embedding: r.one.postEmbeddings({ from: r.posts.id, to: r.postEmbeddings.postId }),
  },
  postEmbeddings: {
    post: r.one.posts({ from: r.postEmbeddings.postId, to: r.posts.id, optional: false }),
  },
  likes: {
    user: r.one.users({ from: r.likes.userId, to: r.users.id, optional: false }),
    post: r.one.posts({ from: r.likes.postId, to: r.posts.id, optional: false }),
  },
}));
