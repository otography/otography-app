import { props } from "@stylexjs/stylex";
import {
  AlertDialog,
  AlertDialogBackdrop,
  AlertDialogClose,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@ui-sdk/react/alert-dialog";
import { Button } from "@ui-sdk/react/button";
import type { ReactNode } from "react";
import { artworkUrl } from "#/lib/musickit";
import type { FavoriteDecoration } from "#/lib/profile";
import { favoriteAccentStyles } from "./favorite-colors";
import { favoriteStyles as styles } from "./favorite-styles";
import { ChevronDownIcon, ChevronUpIcon, TrashIcon } from "./icons";

function Root({ color, children }: { color: FavoriteDecoration["color"]; children: ReactNode }) {
  const accentStyle = color ? favoriteAccentStyles[color] : null;
  return <li {...props(styles.card, accentStyle)}>{children}</li>;
}

function Main({ children }: { children: ReactNode }) {
  return <div {...props(styles.cardMain)}>{children}</div>;
}

function Rank({ index }: { index: number }) {
  return (
    <span {...props(styles.rank)} aria-label={`${index + 1} 番目`}>
      {String(index + 1).padStart(2, "0")}
    </span>
  );
}

/** ジャケット画像（なければ fallback）と絵文字バッジ。shape で角丸の形を切り替える。 */
function Art({
  src,
  fallback,
  emoji,
  shape = "square",
}: {
  src: string | null | undefined;
  fallback: ReactNode;
  emoji: string | null;
  shape?: "square" | "round";
}) {
  const round = shape === "round";
  return (
    <div {...props(styles.artWrap)}>
      {src ? (
        <img
          src={artworkUrl(src, 112)}
          alt=""
          width={52}
          height={52}
          {...props(styles.cardArt, round && styles.roundCardArt)}
        />
      ) : (
        <div
          {...props(styles.cardArt, styles.artFallback, round && styles.roundCardArt)}
          aria-hidden="true"
        >
          {fallback}
        </div>
      )}
      {emoji ? (
        <span {...props(styles.emojiBadge, round && styles.roundEmojiBadge)} aria-hidden="true">
          {emoji}
        </span>
      ) : null}
    </div>
  );
}

function Meta({ children }: { children: ReactNode }) {
  return <div {...props(styles.meta)}>{children}</div>;
}

function Actions({ children }: { children: ReactNode }) {
  return <div {...props(styles.rowActions)}>{children}</div>;
}

function MoveButtons({
  label,
  index,
  total,
  saving,
  onMove,
}: {
  label: string;
  index: number;
  total: number;
  saving: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  return (
    <>
      <Button
        type="button"
        disabled={index === 0 || saving}
        aria-label={`「${label}」を上に移動`}
        onClick={() => onMove(-1)}
        {...props(styles.iconBtn)}
      >
        <ChevronUpIcon />
      </Button>
      <Button
        type="button"
        disabled={index === total - 1 || saving}
        aria-label={`「${label}」を下に移動`}
        onClick={() => onMove(1)}
        {...props(styles.iconBtn)}
      >
        <ChevronDownIcon />
      </Button>
    </>
  );
}

/** noun は「好きな曲」「好きなアーティスト」のような一覧の呼び名。 */
function RemoveDialog({
  label,
  noun,
  saving,
  onRemove,
}: {
  label: string;
  noun: string;
  saving: boolean;
  onRemove: () => Promise<void>;
}) {
  return (
    <AlertDialog pendingAnnouncement={`${noun}から削除しています`}>
      <AlertDialogTrigger
        disabled={saving}
        aria-label={`「${label}」を${noun}から削除`}
        {...props(styles.deleteBtn)}
      >
        <TrashIcon />
      </AlertDialogTrigger>
      <AlertDialogBackdrop {...props(styles.backdrop)} />
      <AlertDialogContent {...props(styles.alertDialog)}>
        <AlertDialogTitle {...props(styles.dialogTitle)}>{noun}から外しますか？</AlertDialogTitle>
        <AlertDialogDescription {...props(styles.dialogDesc)}>
          「{label}」を{noun}リストから削除します。
        </AlertDialogDescription>
        <div {...props(styles.dialogFooter)}>
          <AlertDialogClose {...props(styles.secondaryBtn)}>キャンセル</AlertDialogClose>
          <AlertDialogClose
            value="confirm"
            data-agent-confirm={`「${label}」を${noun}から削除します`}
            action={onRemove}
            {...props(styles.dangerBtn)}
          >
            リストから外す
          </AlertDialogClose>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function Comment({ children }: { children: string | null }) {
  return children ? <p {...props(styles.comment)}>{children}</p> : null;
}

/** お気に入り 1 件分の行。Root の中に Main / Comment を並べ、Main の中に部品を組み合わせる。 */
export const FavoriteRow = {
  Root,
  Main,
  Rank,
  Art,
  Meta,
  Actions,
  MoveButtons,
  RemoveDialog,
  Comment,
};
