import * as stylex from "@stylexjs/stylex";
import { useQuery } from "@tanstack/react-query";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ReportsQueue } from "#/admin/ReportsQueue";
import { meQuery } from "#/profiles/queries";
import { colors, space } from "#/styles/tokens.stylex";

export const Route = createFileRoute("/admin/reports")({ component: AdminReportsPage });

function AdminReportsPage() {
  const me = useQuery(meQuery);
  if (me.isPending) return <p {...stylex.props(styles.page)}>読み込み中…</p>;
  if (!me.data?.isAdmin) {
    return (
      <p {...stylex.props(styles.page)}>
        管理者だけが開けるページです。<Link to="/">トップ</Link>へ戻る
      </p>
    );
  }
  return (
    <div {...stylex.props(styles.page, styles.stack)}>
      <h1 {...stylex.props(styles.title)}>未処理の通報</h1>
      <ReportsQueue />
    </div>
  );
}

const styles = stylex.create({
  page: { padding: space.xl, color: colors.text },
  stack: { display: "flex", flexDirection: "column", gap: space.lg },
  title: { margin: 0, fontSize: 24 },
});
