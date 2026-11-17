import { zValidator } from "@hono/zod-validator";
import * as errore from "errore";
import { Hono } from "hono";
import { requireAuth, type SessionEnv } from "../auth/session.ts";
import { db } from "../lib/db.ts";
import { rateLimit } from "../lib/rate-limit/middleware.ts";
import { createReportInput } from "./schemas.ts";
import { createReport } from "./usecases/create-report.ts";

export const reportsRoutes = new Hono<SessionEnv>()
  // 投稿かユーザーを通報する。同じ対象を重ねて通報しても 204 を返す。
  .post(
    "/",
    requireAuth,
    rateLimit("WRITE_RATE_LIMIT"),
    zValidator("json", createReportInput, (result, c) => {
      if (!result.success) {
        return c.json(
          {
            error: "入力が正しくありません。理由と対象を確認してください",
            issues: result.error.issues,
          },
          400,
        );
      }
    }),
    async (c) => {
      const report = await createReport({
        db,
        reporterId: c.get("user").id,
        input: c.req.valid("json"),
      });
      if (report instanceof Error) {
        const { status, error } = errore.matchErrorPartial<
          typeof report,
          { status: 400 | 404 | 500; error: string }
        >(
          report,
          {
            ReportTargetNotFoundError: (e) => ({ status: 404, error: e.message }),
            SelfReportError: (e) => ({ status: 400, error: e.message }),
          },
          (e) => {
            console.error(e);
            return {
              status: 500,
              error: "通報できませんでした。時間をおいて、もう一度試してください",
            };
          },
        );
        return c.json({ error }, status);
      }
      return c.body(null, 204);
    },
  );
