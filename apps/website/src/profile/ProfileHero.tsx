import { create, props } from "@stylexjs/stylex";
import { Avatar, AvatarFallback, AvatarImage } from "@ui-sdk/react/avatar";
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Textarea } from "@ui-sdk/react/textarea";
import { useState } from "react";
import { CloseIcon } from "#/chat/icons";
import { chatMedia, chatTokens as t } from "#/chat/tokens.stylex";
import { motion } from "#/motion.stylex";
import { EditIcon } from "./icons";
import { useProfile } from "./ProfileContext";

function initials(name: string) {
  return Array.from(name.trim()).slice(0, 2).join("") || "U";
}

function countChars(value: string) {
  return Array.from(value.trim()).length;
}

function ProfileEditDialog() {
  const { state, actions, meta } = useProfile();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(state.user.name);
  const [bio, setBio] = useState(state.user.bio ?? "");
  const [nameError, setNameError] = useState<string | null>(null);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setName(state.profile?.name ?? state.user.name);
      setBio(state.profile?.bio ?? state.user.bio ?? "");
      setNameError(null);
    }
    setOpen(next);
  };

  const nameLength = countChars(name);
  const bioLength = countChars(bio);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmedName = name.trim();
    if (!trimmedName) {
      setNameError("表示名を入力してください");
      return;
    }
    if (nameLength > meta.userNameMax) {
      setNameError(`表示名は ${meta.userNameMax} 文字以内で入力してください`);
      return;
    }
    if (bioLength > meta.userBioMax) {
      return;
    }
    try {
      await actions.updateProfile({ name: trimmedName, bio: bio.trim() });
      setOpen(false);
    } catch {
      // エラー通知は Provider 側の toast で行う。
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger {...props(styles.editBtn)}>
        <EditIcon />
        <span>プロフィールを編集</span>
      </DialogTrigger>
      <DialogBackdrop {...props(styles.backdrop)} />
      <DialogContent {...props(styles.dialog)}>
        <div {...props(styles.dialogHeader)}>
          <div {...props(styles.dialogHeading)}>
            <DialogTitle {...props(styles.dialogTitle)}>プロフィールを編集</DialogTitle>
            <DialogDescription {...props(styles.dialogDesc)}>
              表示名と自己紹介は、他のユーザーにも公開されます。
            </DialogDescription>
          </div>
          <DialogClose aria-label="閉じる" {...props(styles.closeBtn)}>
            <CloseIcon />
          </DialogClose>
        </div>

        <form {...props(styles.form)} onSubmit={(event) => void handleSubmit(event)}>
          <Field name="displayName" invalid={nameError ? true : undefined}>
            <FieldLabel {...props(styles.label)}>表示名</FieldLabel>
            <Input
              value={name}
              onValueChange={(value) => {
                setName(value);
                setNameError(null);
              }}
              maxLength={meta.userNameMax}
              required
              placeholder="表示名"
              {...props(styles.input)}
            />
            <FieldDescription {...props(styles.fieldHint)}>
              {nameLength} / {meta.userNameMax}
            </FieldDescription>
            <FieldError match="valueMissing">表示名を入力してください</FieldError>
            {nameError ? <FieldError match>{nameError}</FieldError> : null}
          </Field>

          <Field name="bio" invalid={bioLength > meta.userBioMax ? true : undefined}>
            <FieldLabel {...props(styles.label)}>自己紹介</FieldLabel>
            <Textarea
              value={bio}
              onValueChange={setBio}
              rows={4}
              maxLength={meta.userBioMax}
              placeholder="よく聴くジャンルや、音楽の好みなどを書いてみましょう"
              {...props(styles.textarea)}
            />
            <FieldDescription {...props(styles.fieldHint)}>
              {bioLength} / {meta.userBioMax}
            </FieldDescription>
            {bioLength > meta.userBioMax ? (
              <FieldError match>自己紹介は {meta.userBioMax} 文字以内で入力してください</FieldError>
            ) : null}
          </Field>

          <div {...props(styles.dialogFooter)}>
            <DialogClose {...props(styles.secondaryBtn)}>キャンセル</DialogClose>
            <Button
              type="submit"
              disabled={state.isUpdatingProfile || !name.trim() || bioLength > meta.userBioMax}
              {...props(styles.primaryBtn)}
            >
              {state.isUpdatingProfile ? "保存中…" : "変更を保存"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function ProfileHero() {
  const { state, meta } = useProfile();
  const displayName = state.profile?.name ?? state.user.name;
  const bio = state.profile?.bio ?? state.user.bio;
  const image = state.profile?.image ?? state.user.image;

  return (
    <section aria-label="プロフィール概要" {...props(styles.hero)}>
      <div {...props(styles.heroTop)}>
        <div {...props(styles.identity)}>
          <Avatar role="img" aria-label={displayName} {...props(styles.avatar)}>
            {image ? (
              <AvatarImage
                src={image}
                alt={displayName}
                referrerPolicy="no-referrer"
                {...props(styles.avatarImg)}
              />
            ) : null}
            <AvatarFallback>
              <span aria-hidden="true">{initials(displayName)}</span>
            </AvatarFallback>
          </Avatar>

          <div {...props(styles.nameBlock)}>
            <h1 {...props(styles.name)}>{displayName}</h1>
            <span {...props(styles.handle)}>@{state.user.publicId}</span>
          </div>
        </div>

        <ProfileEditDialog />
      </div>

      {bio ? (
        <p {...props(styles.bio)}>{bio}</p>
      ) : (
        <p {...props(styles.bioEmpty)}>
          自己紹介はまだ設定されていません。よく聴く音楽や気分を書いてみましょう。
        </p>
      )}

      <dl {...props(styles.stats)}>
        <div {...props(styles.statItem)}>
          <dt {...props(styles.statLabel)}>投稿</dt>
          <dd {...props(styles.statValue)}>
            {state.posts.length}
            {state.hasNextPosts ? "+" : ""}
          </dd>
        </div>
        <div {...props(styles.statItem)}>
          <dt {...props(styles.statLabel)}>好きな曲</dt>
          <dd {...props(styles.statValue)}>
            {state.favoriteSongs.length}
            <span {...props(styles.statDenom)}> / {meta.favoriteLimit}</span>
          </dd>
        </div>
        <div {...props(styles.statItem)}>
          <dt {...props(styles.statLabel)}>好きなアーティスト</dt>
          <dd {...props(styles.statValue)}>
            {state.favoriteArtists.length}
            <span {...props(styles.statDenom)}> / {meta.favoriteLimit}</span>
          </dd>
        </div>
      </dl>
    </section>
  );
}

const styles = create({
  hero: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    paddingTop: {
      default: 24,
      [chatMedia.compact]: 16,
    },
    paddingRight: {
      default: 24,
      [chatMedia.compact]: 16,
    },
    paddingBottom: {
      default: 22,
      [chatMedia.compact]: 16,
    },
    paddingLeft: {
      default: 24,
      [chatMedia.compact]: 16,
    },
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 20,
  },
  heroTop: {
    display: "flex",
    flexWrap: "wrap",
    gap: 14,
    alignItems: "center",
    justifyContent: "space-between",
  },
  identity: {
    display: "flex",
    gap: 14,
    alignItems: "center",
    minWidth: 0,
  },
  avatar: {
    display: "inline-flex",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
    width: {
      default: 60,
      [chatMedia.compact]: 52,
    },
    height: {
      default: 60,
      [chatMedia.compact]: 52,
    },
    overflow: "hidden",
    fontSize: 20,
    fontWeight: 600,
    backgroundColor: t.hover,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9999,
  },
  avatarImg: {
    width: "100%",
    height: "100%",
    objectFit: "cover",
  },
  nameBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    minWidth: 0,
  },
  name: {
    margin: 0,
    overflow: "hidden",
    textOverflow: "ellipsis",
    fontSize: {
      default: 22,
      [chatMedia.compact]: 19,
    },
    fontWeight: 600,
    letterSpacing: "-0.02em",
    whiteSpace: "nowrap",
  },
  handle: {
    fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
    fontSize: 12,
    color: t.muted,
  },
  bio: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.65,
    color: t.text,
    wordBreak: "break-word",
    whiteSpace: "pre-wrap",
  },
  bioEmpty: {
    margin: 0,
    fontSize: 13,
    lineHeight: 1.6,
    color: t.muted,
  },
  stats: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    paddingTop: 14,
    margin: 0,
    borderTopColor: t.border,
    borderTopStyle: "solid",
    borderTopWidth: 1,
  },
  statItem: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 500,
    color: t.muted,
  },
  statValue: {
    margin: 0,
    fontSize: 18,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    letterSpacing: "-0.02em",
  },
  statDenom: {
    fontSize: 12,
    fontWeight: 400,
    color: t.muted,
  },
  editBtn: {
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    height: 34,
    paddingBlock: 0,
    paddingInline: 12,
    fontSize: 13,
    fontWeight: 500,
    color: t.text,
    cursor: "pointer",
    backgroundColor: {
      default: t.surfaceElevated,
      ":hover": {
        default: t.surfaceElevated,
        [chatMedia.hover]: t.hover,
      },
    },
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 10,
    transform: {
      default: null,
      ":active": {
        default: "scale(0.97)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 160ms ${motion.easeOut}, background-color 150ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "background-color 120ms ease",
    },
  },
  backdrop: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(0, 0, 0, 0.42)",
    backdropFilter: "blur(2px)",
  },
  dialog: {
    width: "min(480px, calc(100vw - 24px))",
    padding: 20,
    color: t.text,
    backgroundColor: t.surfaceElevated,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 18,
    boxShadow: t.shadow,
  },
  dialogHeader: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  dialogHeading: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  dialogTitle: {
    margin: 0,
    fontSize: 17,
    fontWeight: 600,
    letterSpacing: "-0.01em",
  },
  dialogDesc: {
    margin: 0,
    fontSize: 13,
    color: t.muted,
  },
  closeBtn: {
    display: "grid",
    flexShrink: 0,
    placeItems: "center",
    width: 30,
    height: 30,
    padding: 0,
    color: t.muted,
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": {
        default: "transparent",
        [chatMedia.hover]: t.hover,
      },
    },
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 9999,
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: t.text,
  },
  input: {
    width: "100%",
    height: 38,
    paddingBlock: 0,
    paddingInline: 12,
    fontSize: 14,
    color: t.text,
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 10,
  },
  textarea: {
    width: "100%",
    paddingBlock: 10,
    paddingInline: 12,
    fontFamily: "inherit",
    fontSize: 14,
    lineHeight: 1.55,
    color: t.text,
    resize: "vertical",
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 10,
  },
  fieldHint: {
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    color: t.muted,
  },
  dialogFooter: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 4,
  },
  secondaryBtn: {
    height: 36,
    paddingBlock: 0,
    paddingInline: 14,
    fontSize: 13,
    fontWeight: 500,
    color: t.text,
    cursor: "pointer",
    backgroundColor: {
      default: "transparent",
      ":hover": {
        default: "transparent",
        [chatMedia.hover]: t.hover,
      },
    },
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 10,
  },
  primaryBtn: {
    height: 36,
    paddingBlock: 0,
    paddingInline: 16,
    fontSize: 13,
    fontWeight: 600,
    color: t.primaryFg,
    cursor: {
      default: "pointer",
      ":disabled": "not-allowed",
    },
    backgroundColor: t.primary,
    borderStyle: "none",
    borderWidth: 0,
    borderRadius: 10,
    opacity: {
      default: 1,
      ":disabled": 0.4,
    },
  },
});
