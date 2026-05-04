-- Custom SQL migration file, put your code below! --
-- Runtime role grants required by the application.
--
-- The app connects as postgres but defaults that session to anon. Authenticated
-- requests temporarily switch to authenticated, while controlled server-side
-- sync work can switch back to postgres inside a transaction.
GRANT anon TO postgres;--> statement-breakpoint
GRANT authenticated TO postgres;--> statement-breakpoint

GRANT USAGE ON SCHEMA public TO anon, authenticated;--> statement-breakpoint

GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;--> statement-breakpoint

GRANT USAGE ON TYPE public.artist_type TO authenticated;--> statement-breakpoint
GRANT USAGE ON TYPE public.prefecture TO authenticated;--> statement-breakpoint

GRANT EXECUTE ON FUNCTION public.requesting_user_id() TO authenticated;--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.resolve_firebase_id(varchar) TO anon, authenticated;
