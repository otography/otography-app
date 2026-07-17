import * as errore from "errore";
import { createMiddleware } from "hono/factory";
import { createDbClient, type DatabaseClient } from "../db";
import type { Env } from "../types/env";

export const dbMiddleware = () =>
  createMiddleware<Env>(async (c, next) => {
    using cleanup = new errore.DisposableStack();
    let client: DatabaseClient | undefined;

    c.set("db", () => {
      if (client) return client.db;

      const createdClient = createDbClient();
      client = createdClient;
      cleanup.defer(() => {
        const closePromise = createdClient.end().catch((error: unknown) => {
          console.error("Failed to close database connection.", error);
        });

        const registration = errore.try(() => c.executionCtx.waitUntil(closePromise));
        if (registration instanceof Error) {
          console.warn("Failed to register database connection close task.", registration);
        }
      });
      return createdClient.db;
    });

    await next();
  });
