import { props } from "@stylexjs/stylex";
import { Button } from "@ui-sdk/react/button";
import {
  Dialog,
  DialogBackdrop,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@ui-sdk/react/dialog";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { CloseIcon } from "#/chat/icons";
import type { FavoriteDecoration } from "#/lib/profile";
import { FavoriteDecorationFields, validateDecoration } from "./FavoriteDecorationEditor";
import { favoriteStyles as styles } from "./favorite-styles";
import { EditIcon, SearchIcon } from "./icons";

const EMPTY_DECORATION: FavoriteDecoration = { comment: null, emoji: null, color: null };

const normalizeDecoration = (decoration: FavoriteDecoration): FavoriteDecoration => ({
  comment: decoration.comment?.trim() || null,
  emoji: decoration.emoji?.trim() || null,
  color: decoration.color,
});

type FavoriteSearch<T> = {
  query: string;
  setQuery: (value: string) => void;
  results: Array<T>;
  searching: boolean;
  error: string | null;
  reset: () => void;
};

/** ダイアログが開いている間、入力に合わせて検索 API を debounce 付きで呼ぶ。 */
function useFavoriteSearch<T>(
  searchFn: (query: string) => Promise<Array<T>>,
  open: boolean,
): FavoriteSearch<T> {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Array<T>>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const trimmedQuery = open ? query.trim() : "";

  useEffect(() => {
    if (!trimmedQuery) {
      return;
    }

    let cancelled = false;

    const timer = window.setTimeout(() => {
      setSearching(true);
      setError(null);
      searchFn(trimmedQuery)
        .then((found) => {
          if (cancelled) {
            return;
          }
          setResults(found);
          setSearching(false);
        })
        .catch((error_: unknown) => {
          if (cancelled) {
            return;
          }
          setResults([]);
          setSearching(false);
          setError(error_ instanceof Error ? error_.message : "検索に失敗しました");
        });
    }, 220);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [trimmedQuery, searchFn]);

  return {
    query,
    setQuery,
    results: trimmedQuery ? results : [],
    searching: trimmedQuery ? searching : false,
    error: trimmedQuery ? error : null,
    reset: () => {
      setQuery("");
      setResults([]);
      setSearching(false);
      setError(null);
    },
  };
}

/** 追加ダイアログの状態（開閉・検索・選択・飾り）をまとめる。 */
export function useFavoriteAddDraft<T>(searchFn: (query: string) => Promise<Array<T>>) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<T | null>(null);
  const [decoration, setDecoration] = useState<FavoriteDecoration>(EMPTY_DECORATION);
  const search = useFavoriteSearch(searchFn, open);

  const onOpenChange = (next: boolean) => {
    if (!next) {
      search.reset();
      setSelected(null);
      setDecoration(EMPTY_DECORATION);
    }
    setOpen(next);
  };

  const { emojiError, commentError } = validateDecoration(decoration);

  const save = async (add: (item: T, decoration: FavoriteDecoration) => Promise<void>) => {
    if (!selected) {
      return;
    }
    try {
      await add(selected, normalizeDecoration(decoration));
      onOpenChange(false);
    } catch {
      // エラー通知は Provider 側の toast で行う。
    }
  };

  return {
    open,
    onOpenChange,
    selected,
    setSelected,
    decoration,
    setDecoration,
    isDecorationValid: !emojiError && !commentError,
    search,
    save,
  };
}

export function FavoriteDialogContent({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <>
      <DialogBackdrop {...props(styles.backdrop)} />
      <DialogContent {...props(styles.dialog)}>
        <div {...props(styles.dialogHeader)}>
          <div {...props(styles.dialogHeading)}>
            <DialogTitle {...props(styles.dialogTitle)}>{title}</DialogTitle>
            <DialogDescription {...props(styles.dialogDesc)}>{description}</DialogDescription>
          </div>
          <DialogClose aria-label="閉じる" {...props(styles.closeBtn)}>
            <CloseIcon />
          </DialogClose>
        </div>
        {children}
      </DialogContent>
    </>
  );
}

export function FavoriteDialogForm({
  onSubmit,
  children,
}: {
  onSubmit: (event: { preventDefault: () => void }) => void;
  children: ReactNode;
}) {
  return (
    <form {...props(styles.form)} onSubmit={onSubmit}>
      {children}
    </form>
  );
}

export function FavoriteDialogFooter({
  disabled,
  children,
}: {
  disabled: boolean;
  children: ReactNode;
}) {
  return (
    <div {...props(styles.dialogFooter)}>
      <DialogClose {...props(styles.secondaryBtn)}>キャンセル</DialogClose>
      <Button type="submit" disabled={disabled} {...props(styles.primaryBtn)}>
        {children}
      </Button>
    </div>
  );
}

export function FavoriteSelectedBox({
  resetLabel,
  onReset,
  children,
}: {
  resetLabel: string;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <div {...props(styles.selectedBox)}>
      {children}
      <Button type="button" {...props(styles.secondaryBtnSm)} onClick={onReset}>
        {resetLabel}
      </Button>
    </div>
  );
}

/** 検索欄・状態表示・結果リスト（children）をまとめた検索セクション。 */
export function FavoriteSearchSection<T>({
  name,
  label,
  placeholder,
  idleMessage,
  notFoundMessage,
  search,
  children,
}: {
  name: string;
  label: string;
  placeholder: string;
  idleMessage: string;
  notFoundMessage: string;
  search: FavoriteSearch<T>;
  children: ReactNode;
}) {
  const { query, results, searching, error } = search;
  const status = searching
    ? "検索中…"
    : (error ??
      (query.trim() && results.length === 0
        ? notFoundMessage
        : results.length > 0
          ? `${results.length} 件の候補`
          : idleMessage));

  return (
    <div {...props(styles.searchSection)}>
      <Field name={name}>
        <FieldLabel {...props(styles.label)}>{label}</FieldLabel>
        <div {...props(styles.searchInputWrap)}>
          <span {...props(styles.searchIcon)} aria-hidden="true">
            <SearchIcon />
          </span>
          <Input
            value={query}
            onValueChange={search.setQuery}
            placeholder={placeholder}
            {...props(styles.searchInput)}
          />
        </div>
      </Field>

      <div role="status" aria-live="polite" {...props(styles.searchStatus)}>
        {status}
      </div>

      {results.length > 0 ? children : null}
    </div>
  );
}

/** 既存のお気に入りのメモ・絵文字・色を編集するダイアログ。 */
export function EditFavoriteDialog({
  title,
  initial,
  fieldPrefix,
  saving,
  onSave,
}: {
  title: string;
  initial: FavoriteDecoration;
  fieldPrefix: string;
  saving: boolean;
  onSave: (decoration: FavoriteDecoration) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [decoration, setDecoration] = useState<FavoriteDecoration>(initial);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setDecoration(initial);
    }
    setOpen(next);
  };

  const { emojiError, commentError } = validateDecoration(decoration);
  const canSave = !emojiError && !commentError && !saving;

  const handleSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!canSave) {
      return;
    }
    try {
      await onSave(normalizeDecoration(decoration));
      setOpen(false);
    } catch {
      // エラー通知は Provider 側の toast で行う。
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger aria-label={`「${title}」のメモと飾りを編集`} {...props(styles.iconBtn)}>
        <EditIcon />
      </DialogTrigger>
      <FavoriteDialogContent
        title={`「${title}」を編集`}
        description="ひとことメモ、絵文字バッジ、アクセントカラーを設定できます。"
      >
        <FavoriteDialogForm onSubmit={(event) => void handleSubmit(event)}>
          <FavoriteDecorationFields
            value={decoration}
            onChange={setDecoration}
            fieldPrefix={fieldPrefix}
          />
          <FavoriteDialogFooter disabled={!canSave}>
            {saving ? "保存中…" : "変更を保存"}
          </FavoriteDialogFooter>
        </FavoriteDialogForm>
      </FavoriteDialogContent>
    </Dialog>
  );
}
