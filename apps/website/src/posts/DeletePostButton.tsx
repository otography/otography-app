import { useMutation, useQueryClient } from "@tanstack/react-query";
import { client } from "#/lib/api";
import { SmallButton } from "#/ui/button";
import { removePostFromCaches } from "./post-cache";

/** 自分の投稿を削除するボタン。確認してから消す。 */
export function DeletePostButton({ postId }: { postId: string }) {
  const queryClient = useQueryClient();
  const remove = useMutation({
    mutationFn: async () => {
      const res = await client.api.posts[":id"].$delete({ param: { id: postId } });
      if (res.ok) return;
      const body = await res.json();
      throw new Error(body.error);
    },
    onSuccess: () => removePostFromCaches(queryClient, postId),
    onError: (error) => window.alert(error.message),
  });

  return (
    <SmallButton
      disabled={remove.isPending}
      onClick={() => {
        if (window.confirm("この投稿を削除しますか？元に戻せません")) remove.mutate();
      }}
    >
      {remove.isPending ? "削除中…" : "削除"}
    </SmallButton>
  );
}
