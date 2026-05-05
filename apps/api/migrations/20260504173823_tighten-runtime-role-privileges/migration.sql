-- Custom SQL migration file, put your code below! --
-- Tighten runtime role grants introduced for RLS execution.
--
-- Existing migrations are immutable; this migration narrows the broad
-- ALL TABLES grants and removes direct authenticated inserts into users.
DROP POLICY IF EXISTS "users_insert_authenticated" ON "users";
--> statement-breakpoint
REVOKE SELECT ON ALL TABLES IN SCHEMA public FROM anon;
--> statement-breakpoint
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM authenticated;
--> statement-breakpoint
GRANT SELECT ON TABLE
  public.user_profiles,
  public.artists,
  public.songs,
  public.song_artists,
  public.groups,
  public.group_songs,
  public.genres,
  public.song_genres,
  public.posts
TO anon;
--> statement-breakpoint
GRANT SELECT ON TABLE
  public.users,
  public.user_profiles,
  public.artists,
  public.favorite_artists,
  public.songs,
  public.song_artists,
  public.groups,
  public.group_songs,
  public.genres,
  public.song_genres,
  public.favorite_songs,
  public.posts,
  public.post_likes
TO authenticated;
--> statement-breakpoint
GRANT INSERT, UPDATE, DELETE ON TABLE
  public.artists,
  public.favorite_artists,
  public.songs,
  public.song_artists,
  public.groups,
  public.group_songs,
  public.genres,
  public.song_genres,
  public.favorite_songs,
  public.posts,
  public.post_likes
TO authenticated;
--> statement-breakpoint
GRANT UPDATE ON TABLE public.users TO authenticated;
