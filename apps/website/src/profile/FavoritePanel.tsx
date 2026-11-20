import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { favoriteStyles as styles } from "./favorite-styles";

function Root({ children }: { children: ReactNode }) {
  return <div {...stylex.props(styles.panel)}>{children}</div>;
}

function Bar({
  title,
  count,
  limit,
  children,
}: {
  title: string;
  count: number;
  limit: number;
  children: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.panelBar)}>
      <div {...stylex.props(styles.panelInfo)}>
        <h2 {...stylex.props(styles.panelTitle)}>{title}</h2>
        <span {...stylex.props(styles.panelCount)}>
          {count} / {limit}
        </span>
      </div>
      {children}
    </div>
  );
}

function Loading({ children }: { children: ReactNode }) {
  return (
    <div {...stylex.props(styles.stateBox)} aria-busy="true">
      {children}
    </div>
  );
}

function Empty({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div {...stylex.props(styles.emptyBox)}>
      <div {...stylex.props(styles.emptyIcon)} aria-hidden="true">
        {icon}
      </div>
      <p {...stylex.props(styles.emptyTitle)}>{title}</p>
      <p {...stylex.props(styles.emptyDesc)}>{children}</p>
    </div>
  );
}

function List({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ol {...stylex.props(styles.list)} aria-label={label}>
      {children}
    </ol>
  );
}

/** お気に入り一覧のパネル。Bar / Loading / Empty / List を状態に応じて並べる。 */
export const FavoritePanel = { Root, Bar, Loading, Empty, List };
