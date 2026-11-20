import * as stylex from "@stylexjs/stylex";
import type { Toaster } from "@ui-sdk/core/toast";
import { Toast, ToastDescription, ToastRegion, ToastTitle } from "@ui-sdk/react/toast";
import type { ReactNode } from "react";
import { chatTokens as t } from "#/chat/tokens.stylex";

export function ProfileToasts({ toaster }: { toaster: Toaster<ReactNode> }) {
  return (
    <ToastRegion toaster={toaster} data-agent-hidden="" side="bottom" align="end">
      {() => (
        <Toast {...stylex.props(styles.toast)}>
          <ToastTitle {...stylex.props(styles.toastTitle)} />
          <ToastDescription {...stylex.props(styles.toastDesc)} />
        </Toast>
      )}
    </ToastRegion>
  );
}

const styles = stylex.create({
  toast: {
    paddingBlock: 12,
    paddingInline: 14,
    color: t.text,
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 12,
    boxShadow: t.shadow,
  },
  toastTitle: {
    fontSize: 13,
    fontWeight: 600,
  },
  toastDesc: {
    fontSize: 12,
    color: t.muted,
  },
});
