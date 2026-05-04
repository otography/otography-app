-- Runtime role grants required by the application.
--
-- The app connection can temporarily switch to anon/authenticated inside
-- transactions. Server-side sync is exposed through narrow SECURITY DEFINER
-- functions instead of switching back to the database owner role.
GRANT anon TO postgres;
--> statement-breakpoint
GRANT authenticated TO postgres;
--> statement-breakpoint
GRANT USAGE ON SCHEMA public TO anon, authenticated;
--> statement-breakpoint
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
--> statement-breakpoint
GRANT USAGE ON TYPE public.artist_type TO authenticated;
--> statement-breakpoint
GRANT USAGE ON TYPE public.prefecture TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.requesting_user_id() TO authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.resolve_firebase_id(varchar) TO anon, authenticated;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.sync_firebase_user(varchar) TO authenticated;
