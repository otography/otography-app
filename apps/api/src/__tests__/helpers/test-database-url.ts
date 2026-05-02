const DEFAULT_TEST_DATABASE_URL = "postgresql://postgres@localhost:54322/otography_test";

export const getTestDatabaseUrl = () => process.env.TEST_DATABASE_URL ?? DEFAULT_TEST_DATABASE_URL;

export const getMaintenanceDatabaseUrl = (databaseUrl: string) => {
  const url = new URL(databaseUrl);
  url.pathname = "/postgres";
  return url.toString();
};
