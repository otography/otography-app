import * as stylex from "@stylexjs/stylex";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { USER_BIO_MAX, USER_NAME_MAX } from "db/constants";
import { useState } from "react";
import { client } from "#/lib/api";
import { colors, radius, space } from "#/styles/tokens.stylex";
import { PrimaryButton } from "#/ui/button";
import { meQuery } from "./queries";

// API・DB と同じく、文字数はコードポイントで数える（ADR 0012）。
const countCharacters = (text: string) => Array.from(text.trim()).length;

/** 表示名と自己紹介を編集する。 */
export function ProfileFieldsForm({ name, bio }: { name: string; bio: string | null }) {
  const queryClient = useQueryClient();
  const [draftName, setDraftName] = useState(name);
  const [draftBio, setDraftBio] = useState(bio ?? "");

  const save = useMutation({
    mutationFn: async () => {
      const res = await client.api.me.$patch({ json: { name: draftName, bio: draftBio } });
      const body = await res.json();
      if ("error" in body) throw new Error(body.error);
      return body;
    },
    onSuccess: (me) => {
      queryClient.setQueryData(meQuery.queryKey, me);
      void queryClient.invalidateQueries({ queryKey: ["profile", me.publicId] });
    },
  });

  const nameLength = countCharacters(draftName);
  const bioLength = countCharacters(draftBio);
  const valid = nameLength > 0 && nameLength <= USER_NAME_MAX && bioLength <= USER_BIO_MAX;

  return (
    <form
      {...stylex.props(styles.form)}
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) save.mutate();
      }}
    >
      <label {...stylex.props(styles.field)}>
        <span>
          表示名（{nameLength} / {USER_NAME_MAX}）
        </span>
        <input
          value={draftName}
          onChange={(event) => setDraftName(event.target.value)}
          {...stylex.props(styles.input)}
        />
      </label>
      <label {...stylex.props(styles.field)}>
        <span>
          自己紹介（{bioLength} / {USER_BIO_MAX}）
        </span>
        <textarea
          value={draftBio}
          onChange={(event) => setDraftBio(event.target.value)}
          rows={4}
          {...stylex.props(styles.input, styles.textarea)}
        />
      </label>
      <div {...stylex.props(styles.footer)}>
        <PrimaryButton type="submit" disabled={!valid || save.isPending}>
          {save.isPending ? "保存中…" : "保存する"}
        </PrimaryButton>
        {save.isSuccess && <span role="status">保存しました</span>}
        {save.isError && (
          <span role="alert" {...stylex.props(styles.error)}>
            {save.error.message}
          </span>
        )}
      </div>
    </form>
  );
}

const styles = stylex.create({
  form: { display: "flex", flexDirection: "column", gap: space.md, width: "100%", maxWidth: 640 },
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
  textarea: { resize: "vertical" },
  footer: { display: "flex", gap: space.md, alignItems: "center" },
  error: { fontSize: 14, color: colors.accent },
});
