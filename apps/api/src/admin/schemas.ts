import { posts, reports, users } from "db";
import { createSelectSchema } from "drizzle-orm/zod";
import { z } from "zod";

const reportSelect = createSelectSchema(reports);
const userSelect = createSelectSchema(users);

/** GET /api/admin/reports のクエリ。既定は未処理の通報。 */
export const listReportsQuery = z.object({ status: reportSelect.shape.status.default("open") });

/** POST /api/admin/reports/:id/resolve の入力。処理済み（resolved）か却下（dismissed）。 */
export const resolveReportInput = z.object({ status: reportSelect.shape.status.exclude(["open"]) });

/** 管理者に見せる通報。対象が物理削除されていれば、その項目は null になる。 */
export const adminReportOutput = reportSelect
  .pick({ id: true, reason: true, detail: true, status: true, createdAt: true })
  .extend({
    reporter: userSelect.pick({ publicId: true, name: true }).nullable(),
    targetUser: userSelect.pick({ publicId: true, name: true, suspendedAt: true }).nullable(),
    post: createSelectSchema(posts)
      .pick({ id: true, content: true, hiddenAt: true, deletedAt: true })
      .nullable(),
  });
