import { reports } from "db";
import { createInsertSchema } from "drizzle-orm/zod";
import { z } from "zod";

// 検証の規則は drizzle のスキーマ（理由の候補、詳細の length）から作る。
const reportInsert = createInsertSchema(reports, {
  detail: (schema) => schema.trim().transform((value) => value || null),
});
const fields = reportInsert.pick({ reason: true, detail: true });

/**
 * POST /api/reports の入力。対象は、投稿（postId）かユーザー（publicId）のどちらか 1 つ。
 * ユーザーは内部 ID ではなく公開 ID で受け取る。
 */
export const createReportInput = z.union([
  fields.extend({ postId: z.string().min(1) }).strict(),
  fields.extend({ publicId: z.string().min(1) }).strict(),
]);
