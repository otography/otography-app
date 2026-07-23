import { createInsertSchema, createSelectSchema } from "drizzle-orm/arktype";
import { serverSessions } from "../db/schema";
import { credentialEnvelopeSchema } from "./envelope";

const serverSessionSchemaRefinements = {
  encryptedSessionCredential: credentialEnvelopeSchema,
  encryptedRefreshToken: credentialEnvelopeSchema,
};

const insertServerSessionSchema = createInsertSchema(
  serverSessions,
  serverSessionSchemaRefinements,
);
const selectServerSessionSchema = createSelectSchema(
  serverSessions,
  serverSessionSchemaRefinements,
);

export type InsertServerSessionValues = typeof insertServerSessionSchema.infer;
export type SelectServerSessionValues = typeof selectServerSessionSchema.infer;
