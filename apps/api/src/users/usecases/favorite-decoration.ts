/** お気に入りの飾り（コメント、絵文字、色）。送られなかった項目は NULL として保存する。 */
export const decorationOf = <Color extends string>(item: {
  comment?: string | null;
  emoji?: string | null;
  color?: Color | null;
}) => ({ comment: item.comment ?? null, emoji: item.emoji ?? null, color: item.color ?? null });
