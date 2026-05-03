/*
 * Vendored from kiwicopple/pg-extensions pg_idkit 0.0.4.
 *
 * MIT License
 *
 * Copyright (c) 2023 Fabio Lima:
 *   https://gist.github.com/fabiolimace/515a0440e3e40efeb234e12644a6a346
 *   https://gist.github.com/fabiolimace/5e7923803566beefaf3c716d1343ae27
 *
 * Copyright (c) 2023 Paul Copplestone:
 *   https://github.com/kiwicopple/pg-extensions/
 */
CREATE OR REPLACE FUNCTION public.gen_random_uuid_v7()
RETURNS uuid
LANGUAGE plpgsql
AS $$
DECLARE
    v_time timestamp with time zone := NULL;
    v_secs bigint := NULL;
    v_msec bigint := NULL;
    v_usec bigint := NULL;
    v_timestamp bigint := NULL;
    v_timestamp_hex varchar := NULL;
    v_random bigint := NULL;
    v_random_hex varchar := NULL;
    v_bytes bytea;
    c_variant bit(64) := x'8000000000000000';
BEGIN
    v_time := clock_timestamp();
    v_secs := EXTRACT(EPOCH FROM v_time);
    v_msec := mod(EXTRACT(MILLISECONDS FROM v_time)::numeric, 10^3::numeric);
    v_usec := mod(EXTRACT(MICROSECONDS FROM v_time)::numeric, 10^3::numeric);

    v_timestamp := (((v_secs * 10^3) + v_msec)::bigint << 12) | (v_usec << 2);
    v_timestamp_hex := lpad(to_hex(v_timestamp), 16, '0');
    v_timestamp_hex := substr(v_timestamp_hex, 2, 12) || '7' || substr(v_timestamp_hex, 14, 3);

    v_random := ((random()::numeric * 2^62::numeric)::bigint::bit(64) | c_variant)::bigint;
    v_random_hex := lpad(to_hex(v_random), 16, '0');

    v_bytes := decode(v_timestamp_hex || v_random_hex, 'hex');

    RETURN encode(v_bytes, 'hex')::uuid;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.uuid_generate_v7()
RETURNS uuid
LANGUAGE sql
VOLATILE
PARALLEL SAFE
AS $$
    SELECT public.gen_random_uuid_v7()
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.requesting_user_id()
RETURNS uuid
LANGUAGE sql
STABLE
RETURNS NULL ON NULL INPUT
SET search_path = pg_catalog
AS $$
    SELECT NULLIF(
        current_setting('request.jwt.claims', true)::json->>'sub',
        ''
    )::uuid;
$$;
