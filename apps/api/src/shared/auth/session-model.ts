import { createInsertSchema, createSelectSchema } from "drizzle-orm/arktype";
import { serverSessions } from "../db/schema";
import { credentialEnvelopeSchema } from "./envelope";

// 認証ミドルウェアで解決済みのサーバーセッション情報
// sign-out / account-deletion がハッシュ再計算やDB再照会なしでセッションを特定するために使用
export type ResolvedSessionContext = {
  sessionId: string;
  userId: string;
  version: number;
};

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
