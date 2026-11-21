import type { ReportStatus } from "db";
import type { Database } from "../../lib/db.ts";
import { ReportsOutputError } from "../errors.ts";
import { findReports } from "../repository.ts";
import { adminReportOutput } from "../schemas.ts";

const LIMIT = 100;

/** 状態ごとの通報を、新しい順に最大 100 件返す。 */
export async function listReports({ db, status }: { db: Database; status: ReportStatus }) {
  const rows = await findReports({ db, status, limit: LIMIT });
  if (rows instanceof Error) {
    return rows;
  }
  const reports = adminReportOutput.array().safeParse(rows);
  if (!reports.success) {
    return new ReportsOutputError({ cause: reports.error });
  }
  return { reports: reports.data };
}
