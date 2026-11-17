import { zValidator } from "@hono/zod-validator";
import * as errore from "errore";
import { Hono } from "hono";
import { requireAuth, type SessionEnv } from "../auth/session.ts";
import { db } from "../lib/db.ts";
import { requireAdmin } from "./middleware.ts";
import { listReportsQuery, resolveReportInput } from "./schemas.ts";
import { listReports } from "./usecases/list-reports.ts";
import { resolveReport, setPostHidden, setUserSuspended } from "./usecases/moderate.ts";
import { logError } from "../lib/log.ts";

const INTERNAL_ERROR = "処理に失敗しました。時間をおいて、もう一度試してください";

/** 管理のユースケースが返しうるエラー。 */
type AdminError = Extract<
  Awaited<
    ReturnType<
      typeof listReports | typeof resolveReport | typeof setPostHidden | typeof setUserSuspended
    >
  >,
  Error
>;

/** 管理の操作のエラーを、HTTP のステータスと文言にする。 */
const toResponse = (error: AdminError) =>
  errore.matchErrorPartial<AdminError, { status: 400 | 404 | 500; error: string }>(
    error,
    {
      ReportNotFoundError: (e) => ({ status: 404, error: e.message }),
      AdminTargetNotFoundError: (e) => ({ status: 404, error: e.message }),
      SelfSuspendError: (e) => ({ status: 400, error: e.message }),
    },
    (e) => {
      logError(e);
      return { status: 500, error: INTERNAL_ERROR };
    },
  );

const invalid = { error: "入力が正しくありません" };

export const adminRoutes = new Hono<SessionEnv>()
  // 通報の一覧。
  .get(
    "/reports",
    requireAuth,
    requireAdmin,
    zValidator("query", listReportsQuery, (result, c) => {
      if (!result.success) return c.json(invalid, 400);
    }),
    async (c) => {
      const page = await listReports({ db, status: c.req.valid("query").status });
      if (page instanceof Error) {
        const { status, error } = toResponse(page);
        return c.json({ error }, status);
      }
      return c.json(page);
    },
  )
  // 通報を処理済みか却下にする。
  .post(
    "/reports/:id/resolve",
    requireAuth,
    requireAdmin,
    zValidator("json", resolveReportInput, (result, c) => {
      if (!result.success) return c.json(invalid, 400);
    }),
    async (c) => {
      const result = await resolveReport({
        db,
        reportId: c.req.param("id"),
        status: c.req.valid("json").status,
      });
      if (result instanceof Error) {
        const { status, error } = toResponse(result);
        return c.json({ error }, status);
      }
      return c.json(result);
    },
  )
  // 投稿を非表示にする（PUT）・非表示を解除する（DELETE）。
  .put("/posts/:id/hidden", requireAuth, requireAdmin, async (c) => {
    const result = await setPostHidden({ db, postId: c.req.param("id"), hidden: true });
    if (result instanceof Error) {
      const { status, error } = toResponse(result);
      return c.json({ error }, status);
    }
    return c.json(result);
  })
  .delete("/posts/:id/hidden", requireAuth, requireAdmin, async (c) => {
    const result = await setPostHidden({ db, postId: c.req.param("id"), hidden: false });
    if (result instanceof Error) {
      const { status, error } = toResponse(result);
      return c.json({ error }, status);
    }
    return c.json(result);
  })
  // ユーザーを停止する（PUT）・停止を解除する（DELETE）。
  .put("/users/:publicId/suspended", requireAuth, requireAdmin, async (c) => {
    const result = await setUserSuspended({
      db,
      adminId: c.get("user").id,
      publicId: c.req.param("publicId"),
      suspended: true,
    });
    if (result instanceof Error) {
      const { status, error } = toResponse(result);
      return c.json({ error }, status);
    }
    return c.json(result);
  })
  .delete("/users/:publicId/suspended", requireAuth, requireAdmin, async (c) => {
    const result = await setUserSuspended({
      db,
      adminId: c.get("user").id,
      publicId: c.req.param("publicId"),
      suspended: false,
    });
    if (result instanceof Error) {
      const { status, error } = toResponse(result);
      return c.json({ error }, status);
    }
    return c.json(result);
  });
