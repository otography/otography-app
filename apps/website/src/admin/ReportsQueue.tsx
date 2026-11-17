import * as stylex from "@stylexjs/stylex";
import { queryOptions, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import type { InferResponseType } from "hono/client";
import { client } from "#/lib/api";
import { colors, radius, space } from "#/styles/tokens.stylex";
import { SmallButton } from "#/ui/button";

type AdminReport = InferResponseType<typeof client.api.admin.reports.$get, 200>["reports"][number];

const reasonLabels: Record<AdminReport["reason"], string> = {
  spam: "スパム・宣伝",
  harassment: "嫌がらせ・攻撃",
  inappropriate: "不適切な内容",
  impersonation: "なりすまし",
  other: "その他",
};

/** 未処理の通報。 */
export const openReportsQuery = queryOptions({
  queryKey: ["admin", "reports", "open"],
  queryFn: async () => {
    const res = await client.api.admin.reports.$get({ query: {} });
    const body = await res.json();
    if ("error" in body) throw new Error(body.error);
    return body;
  },
});

/** 管理の操作を送り、成功したら通報の一覧を読み直す。 */
function useModeration() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (send: () => Promise<Response>) => {
      const res = await send();
      if (res.ok) return;
      const body: { error?: string } = await res.json();
      throw new Error(body.error ?? "操作に失敗しました");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["admin", "reports"] }),
    onError: (error) => window.alert(error.message),
  });
}

/** 未処理の通報の一覧と、管理の操作（投稿の非表示、ユーザーの停止、通報の処理）。 */
export function ReportsQueue() {
  const reports = useQuery(openReportsQuery);
  if (reports.isPending) return <p>読み込み中…</p>;
  if (reports.isError) return <p role="alert">{reports.error.message}</p>;
  if (reports.data.reports.length === 0) return <p>未処理の通報はありません</p>;
  return (
    <ul {...stylex.props(styles.list)}>
      {reports.data.reports.map((report) => (
        <ReportItem key={report.id} report={report} />
      ))}
    </ul>
  );
}

function ReportItem({ report }: { report: AdminReport }) {
  const moderate = useModeration();
  const { post, targetUser } = report;
  return (
    <li {...stylex.props(styles.item)}>
      <p {...stylex.props(styles.meta)}>
        {reasonLabels[report.reason]} ・ 通報者 {report.reporter?.name ?? "（退会済み）"} ・{" "}
        {new Date(report.createdAt).toLocaleString("ja-JP")}
      </p>
      {report.detail && <p {...stylex.props(styles.detail)}>{report.detail}</p>}
      {post && (
        <div {...stylex.props(styles.target)}>
          <span>
            投稿：{post.content}
            {post.hiddenAt && "（非表示）"}
            {post.deletedAt && "（削除済み）"}
          </span>
          {post.hiddenAt ? (
            <SmallButton
              disabled={moderate.isPending}
              onClick={() =>
                moderate.mutate(() =>
                  client.api.admin.posts[":id"].hidden.$delete({ param: { id: post.id } }),
                )
              }
            >
              非表示を解除
            </SmallButton>
          ) : (
            <SmallButton
              disabled={moderate.isPending}
              onClick={() =>
                moderate.mutate(() =>
                  client.api.admin.posts[":id"].hidden.$put({ param: { id: post.id } }),
                )
              }
            >
              投稿を非表示にする
            </SmallButton>
          )}
        </div>
      )}
      {targetUser && (
        <div {...stylex.props(styles.target)}>
          <span>
            ユーザー：
            <Link to="/u/$publicId" params={{ publicId: targetUser.publicId }}>
              {targetUser.name}
            </Link>
            {targetUser.suspendedAt && "（停止中）"}
          </span>
          {targetUser.suspendedAt ? (
            <SmallButton
              disabled={moderate.isPending}
              onClick={() =>
                moderate.mutate(() =>
                  client.api.admin.users[":publicId"].suspended.$delete({
                    param: { publicId: targetUser.publicId },
                  }),
                )
              }
            >
              停止を解除
            </SmallButton>
          ) : (
            <SmallButton
              disabled={moderate.isPending}
              onClick={() => {
                if (!window.confirm(`${targetUser.name} を停止しますか？ログアウトさせます`))
                  return;
                moderate.mutate(() =>
                  client.api.admin.users[":publicId"].suspended.$put({
                    param: { publicId: targetUser.publicId },
                  }),
                );
              }}
            >
              ユーザーを停止する
            </SmallButton>
          )}
        </div>
      )}
      <div {...stylex.props(styles.actions)}>
        <SmallButton
          disabled={moderate.isPending}
          onClick={() =>
            moderate.mutate(() =>
              client.api.admin.reports[":id"].resolve.$post({
                param: { id: report.id },
                json: { status: "resolved" },
              }),
            )
          }
        >
          処理済みにする
        </SmallButton>
        <SmallButton
          disabled={moderate.isPending}
          onClick={() =>
            moderate.mutate(() =>
              client.api.admin.reports[":id"].resolve.$post({
                param: { id: report.id },
                json: { status: "dismissed" },
              }),
            )
          }
        >
          却下する
        </SmallButton>
      </div>
    </li>
  );
}

const styles = stylex.create({
  list: {
    display: "flex",
    flexDirection: "column",
    gap: space.md,
    maxWidth: 720,
    padding: 0,
    margin: 0,
    listStyle: "none",
  },
  item: {
    display: "flex",
    flexDirection: "column",
    gap: space.sm,
    padding: space.md,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.md,
  },
  meta: { margin: 0, fontSize: 14, color: colors.textMuted },
  detail: { margin: 0, whiteSpace: "pre-wrap" },
  target: { display: "flex", flexWrap: "wrap", gap: space.sm, alignItems: "center" },
  actions: { display: "flex", gap: space.sm },
});
