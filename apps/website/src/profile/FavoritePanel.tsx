import { props } from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { favoriteStyles as styles } from "./favorite-styles";

function Root({ children }: { children: ReactNode }) {
  return <div {...props(styles.panel)}>{children}</div>;
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
    <div {...props(styles.panelBar)}>
      <div {...props(styles.panelInfo)}>
        <h2 {...props(styles.panelTitle)}>{title}</h2>
        <span {...props(styles.panelCount)}>
          {count} / {limit}
        </span>
      </div>
      {children}
    </div>
  );
}

function Loading({ children }: { children: ReactNode }) {
  return (
    <div {...props(styles.stateBox)} aria-busy="true">
      {children}
    </div>
  );
}

function Empty({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <div {...props(styles.emptyBox)}>
      <div {...props(styles.emptyIcon)} aria-hidden="true">
        {icon}
      </div>
      <p {...props(styles.emptyTitle)}>{title}</p>
      <p {...props(styles.emptyDesc)}>{children}</p>
    </div>
  );
}

function List({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ol {...props(styles.list)} aria-label={label}>
      {children}
    </ol>
  );
}

/** お気に入り一覧のパネル。Bar / Loading / Empty / List を状態に応じて並べる。 */
export const FavoritePanel = { Root, Bar, Loading, Empty, List };
