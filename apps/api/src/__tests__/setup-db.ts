import { fileURLToPath } from "node:url";
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";
import { getMaintenanceDatabaseUrl, getTestDatabaseUrl } from "./helpers/test-database-url";

const migrationsFolder = fileURLToPath(new URL("../../migrations", import.meta.url));

const ensureTestDatabase = async (databaseUrl: string) => {
  const databaseName = new URL(databaseUrl).pathname.slice(1);
  if (!databaseName.includes("test")) {
    throw new Error(`Refusing to reset non-test database: ${databaseName}`);
  }

  const maintenanceSql = postgres(getMaintenanceDatabaseUrl(databaseUrl), {
    max: 1,
    onnotice: () => undefined,
    prepare: false,
  });
  const rows = await maintenanceSql<{ exists: boolean }[]>`
    SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${databaseName}) AS exists
  `;

  if (!rows[0]?.exists) {
    await maintenanceSql.unsafe(`CREATE DATABASE "${databaseName.replaceAll('"', '""')}"`);
  }

  await maintenanceSql.end();
};

const setupSupabaseCompatibleRoles = async (sql: postgres.Sql) => {
  await sql`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'authenticated') THEN
        CREATE ROLE authenticated NOINHERIT;
      END IF;
      IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = 'anon') THEN
        CREATE ROLE anon NOINHERIT;
      END IF;
    END
    $$;
  `;

  await sql`GRANT USAGE ON SCHEMA public TO authenticated`;
  await sql`GRANT USAGE ON SCHEMA public TO anon`;
  await sql`GRANT CREATE ON SCHEMA public TO authenticated`;
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO authenticated`;
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon`;
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated`;
  await sql`ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon`;
};

const grantMigratedObjectsToTestRoles = async (sql: postgres.Sql) => {
  await sql`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO authenticated`;
  await sql`GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO anon`;
  await sql`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO authenticated`;
  await sql`GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO anon`;
};

export default async function setupDb() {
  const databaseUrl = getTestDatabaseUrl();
  await ensureTestDatabase(databaseUrl);

  const sql = postgres(databaseUrl, { max: 1, onnotice: () => undefined, prepare: false });
  const db = drizzle({ client: sql });

  await sql`DROP SCHEMA IF EXISTS public CASCADE`;
  await sql`DROP SCHEMA IF EXISTS drizzle CASCADE`;
  await sql`CREATE SCHEMA public`;
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  await setupSupabaseCompatibleRoles(sql);
  await migrate(db, { migrationsFolder });
  await grantMigratedObjectsToTestRoles(sql);

  await sql.end();
}
