-- アプリのトランザクション内で anon / authenticated へ一時的にロールを切り替えるための付与。
-- ユーザー作成は SECURITY DEFINER 関数経由のみとし、authenticated に users への INSERT は与えない。
GRANT anon TO postgres;
--> statement-breakpoint
GRANT authenticated TO postgres;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO anon, authenticated;
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
--> statement-breakpoint
GRANT USAGE ON TYPE public.artist_type TO authenticated;
--> statement-breakpoint
GRANT USAGE ON TYPE public.prefecture TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.requesting_user_id() TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.sync_firebase_user(varchar) TO authenticated;
