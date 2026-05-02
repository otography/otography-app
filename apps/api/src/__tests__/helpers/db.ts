import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { getTestDatabaseUrl } from "./test-database-url";

export const createTestSql = () => postgres(getTestDatabaseUrl(), { max: 1, prepare: false });

export const createTestDb = (sql: postgres.Sql) => drizzle({ client: sql, jit: true });

export const resetPublicTables = async (sql: postgres.Sql) => {
  const tables = await sql<{ tablename: string }[]>`
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
      AND tablename <> '__drizzle_migrations'
  `;

  if (tables.length === 0) return;

  const tableNames = tables.map(({ tablename }) => `"public"."${tablename.replaceAll('"', '""')}"`);
  await sql.unsafe(`TRUNCATE TABLE ${tableNames.join(", ")} RESTART IDENTITY CASCADE`);
};
