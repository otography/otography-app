import * as stylex from "@stylexjs/stylex";
import { useMutation } from "@tanstack/react-query";
import { REPORT_DETAIL_MAX, REPORT_REASONS, type ReportReason } from "db/constants";
import { useRef, useState } from "react";
import { client } from "#/lib/api";
import { colors, radius, space } from "#/styles/tokens.stylex";
import { PrimaryButton, SmallButton } from "#/ui/button";

const reasonLabels: Record<ReportReason, string> = {
  spam: "スパム・宣伝",
  harassment: "嫌がらせ・攻撃",
  inappropriate: "不適切な内容",
  impersonation: "なりすまし",
  other: "その他",
};

/** 通報の対象。投稿か、ユーザー（公開 ID）のどちらか。 */
type ReportTarget = { postId: string } | { publicId: string };

/** 通報するボタン。押すと、理由と詳細を選ぶダイアログを開く。 */
export function ReportButton({ target }: { target: ReportTarget }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason>("spam");
  const [detail, setDetail] = useState("");

  const report = useMutation({
    mutationFn: async () => {
      const res = await client.api.reports.$post({ json: { ...target, reason, detail } });
      if (res.ok) return;
      const body = await res.json();
      throw new Error(body.error);
    },
    onSuccess: () => setDetail(""),
  });

  return (
    <>
      <SmallButton
        onClick={() => {
          report.reset();
          dialog.current?.showModal();
        }}
      >
        通報する
      </SmallButton>
      <dialog ref={dialog} {...stylex.props(styles.dialog)}>
        {report.isSuccess ? (
          <div {...stylex.props(styles.form)}>
            <p role="status">通報を受け付けました。管理者が確認します。</p>
            <SmallButton onClick={() => dialog.current?.close()}>閉じる</SmallButton>
          </div>
        ) : (
          <form
            method="dialog"
            {...stylex.props(styles.form)}
            onSubmit={(event) => {
              event.preventDefault();
              report.mutate();
            }}
          >
            <h2 {...stylex.props(styles.heading)}>通報する</h2>
            <label {...stylex.props(styles.field)}>
              <span>理由</span>
              <select
                value={reason}
                onChange={(event) => {
                  const next = REPORT_REASONS.find((value) => value === event.target.value);
                  if (next) setReason(next);
                }}
                {...stylex.props(styles.input)}
              >
                {REPORT_REASONS.map((value) => (
                  <option key={value} value={value}>
                    {reasonLabels[value]}
                  </option>
                ))}
              </select>
            </label>
            <label {...stylex.props(styles.field)}>
              <span>詳細（任意、{REPORT_DETAIL_MAX} 文字まで）</span>
              <textarea
                value={detail}
                onChange={(event) => setDetail(event.target.value)}
                maxLength={REPORT_DETAIL_MAX}
                rows={4}
                {...stylex.props(styles.input)}
              />
            </label>
            {report.isError && (
              <p role="alert" {...stylex.props(styles.error)}>
                {report.error.message}
              </p>
            )}
            <div {...stylex.props(styles.footer)}>
              <SmallButton onClick={() => dialog.current?.close()}>やめる</SmallButton>
              <PrimaryButton type="submit" disabled={report.isPending}>
                {report.isPending ? "送信中…" : "送信する"}
              </PrimaryButton>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}

const styles = stylex.create({
  dialog: {
    width: "min(480px, 90vw)",
    padding: space.lg,
    color: colors.text,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.md,
  },
  form: { display: "flex", flexDirection: "column", gap: space.md },
  heading: { margin: 0, fontSize: 18 },
  field: { display: "flex", flexDirection: "column", gap: space.xs },
  input: {
    padding: space.sm,
    fontFamily: "inherit",
    fontSize: 16,
    borderColor: colors.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: radius.sm,
  },
  footer: { display: "flex", gap: space.sm, justifyContent: "flex-end" },
  error: { margin: 0, fontSize: 14, color: colors.accent },
});
