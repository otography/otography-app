import { create, props } from "@stylexjs/stylex";
import { Button } from "@ui-sdk/react/button";
import { Field, FieldDescription, FieldError, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { Radio, RadioGroup, RadioIndicator } from "@ui-sdk/react/radio";
import { Textarea } from "@ui-sdk/react/textarea";
import { FAVORITE_COLORS, FAVORITE_COMMENT_MAX } from "db/constants";
import { chatMedia, chatTokens as t } from "#/chat/tokens.stylex";
import type { FavoriteDecoration } from "#/lib/profile";
import { motion } from "#/motion.stylex";
import { FAVORITE_COLOR_META } from "./favorite-colors";

const PRESET_EMOJIS = ["🎧", "✨", "🌙", "🔥", "💿", "🎸", "🎹", "🌧️", "🌅", "💫"] as const;
const NO_COLOR_VALUE = "__none__";

const graphemes = new Intl.Segmenter("ja", { granularity: "grapheme" });

function isSingleEmoji(value: string) {
  return (
    Array.from(graphemes.segment(value)).length === 1 &&
    /\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value)
  );
}

export type DecorationValidation = {
  emojiError: string | null;
  commentError: string | null;
};

export function validateDecoration(decoration: FavoriteDecoration): DecorationValidation {
  const emoji = decoration.emoji?.trim() ?? "";
  const comment = decoration.comment?.trim() ?? "";
  const emojiError = emoji && !isSingleEmoji(emoji) ? "絵文字は 1 つだけ入力してください" : null;
  const commentError =
    Array.from(comment).length > FAVORITE_COMMENT_MAX
      ? `ひとことは ${FAVORITE_COMMENT_MAX} 文字以内で入力してください`
      : null;
  return { emojiError, commentError };
}

export function FavoriteDecorationFields({
  value,
  onChange,
  fieldPrefix,
}: {
  value: FavoriteDecoration;
  onChange: (next: FavoriteDecoration) => void;
  fieldPrefix: string;
}) {
  const commentValue = value.comment ?? "";
  const emojiValue = value.emoji ?? "";
  const commentLength = Array.from(commentValue.trim()).length;
  const { emojiError, commentError } = validateDecoration(value);

  return (
    <div {...props(styles.stack)}>
      <Field name={`${fieldPrefix}-comment`} invalid={commentError ? true : undefined}>
        <FieldLabel {...props(styles.label)}>ひとことメモ（任意）</FieldLabel>
        <Textarea
          value={commentValue}
          onValueChange={(next) => onChange({ ...value, comment: next || null })}
          rows={3}
          maxLength={FAVORITE_COMMENT_MAX}
          placeholder="好きな理由や思い出のシーンなど"
          {...props(styles.textarea)}
        />
        <FieldDescription {...props(styles.hint)}>
          {commentLength} / {FAVORITE_COMMENT_MAX}
        </FieldDescription>
        {commentError ? <FieldError match>{commentError}</FieldError> : null}
      </Field>

      <Field name={`${fieldPrefix}-emoji`} invalid={emojiError ? true : undefined}>
        <FieldLabel {...props(styles.label)}>絵文字バッジ（任意）</FieldLabel>
        <div {...props(styles.emojiRow)}>
          <Input
            value={emojiValue}
            onValueChange={(next) => onChange({ ...value, emoji: next.trim() || null })}
            placeholder="例: 🎧"
            {...props(styles.emojiInput)}
          />
          {emojiValue ? (
            <Button
              type="button"
              {...props(styles.clearBtn)}
              onClick={() => onChange({ ...value, emoji: null })}
            >
              絵文字を外す
            </Button>
          ) : null}
        </div>
        <div {...props(styles.presetGrid)} role="group" aria-label="絵文字の候補">
          {PRESET_EMOJIS.map((emoji) => (
            <Button
              key={emoji}
              type="button"
              aria-label={`絵文字 ${emoji} を選ぶ`}
              {...props(styles.presetBtn, emojiValue === emoji && styles.presetBtnSelected)}
              onClick={() => onChange({ ...value, emoji: emojiValue === emoji ? null : emoji })}
            >
              {emoji}
            </Button>
          ))}
        </div>
        {emojiError ? <FieldError match>{emojiError}</FieldError> : null}
      </Field>

      <Field name={`${fieldPrefix}-color`}>
        <FieldLabel {...props(styles.label)}>アクセントカラー（任意）</FieldLabel>
        <RadioGroup
          value={value.color ?? NO_COLOR_VALUE}
          onValueChange={(next) =>
            onChange({
              ...value,
              color: !next || next === NO_COLOR_VALUE ? null : next,
            })
          }
          {...props(styles.colorGroup)}
        >
          <label {...props(styles.colorChip, value.color === null && styles.colorChipSelected)}>
            <Radio value={NO_COLOR_VALUE} {...props(styles.hiddenRadio)}>
              <RadioIndicator />
            </Radio>
            <span {...props(styles.colorDotNone)} aria-hidden="true" />
            <span>なし</span>
          </label>
          {FAVORITE_COLORS.map((color) => {
            const meta = FAVORITE_COLOR_META[color];
            const selected = value.color === color;
            return (
              <label key={color} {...props(styles.colorChip, selected && styles.colorChipSelected)}>
                <Radio value={color} {...props(styles.hiddenRadio)}>
                  <RadioIndicator />
                </Radio>
                <span
                  aria-hidden="true"
                  {...props(styles.colorDot)}
                  style={{ backgroundColor: meta.swatch }}
                />
                <span>{meta.label}</span>
              </label>
            );
          })}
        </RadioGroup>
      </Field>
    </div>
  );
}

const styles = create({
  stack: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: t.text,
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
  hint: {
    fontSize: 12,
    fontVariantNumeric: "tabular-nums",
    color: t.muted,
  },
  emojiRow: {
    display: "flex",
    gap: 8,
    alignItems: "center",
  },
  emojiInput: {
    width: 96,
    height: 36,
    paddingBlock: 0,
    paddingInline: 10,
    fontSize: 16,
    color: t.text,
    textAlign: "center",
    backgroundColor: t.surface,
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 10,
  },
  clearBtn: {
    height: 32,
    paddingBlock: 0,
    paddingInline: 10,
    fontSize: 12,
    color: t.muted,
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
    borderRadius: 8,
  },
  presetGrid: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 6,
  },
  presetBtn: {
    display: "grid",
    placeItems: "center",
    width: 34,
    height: 34,
    padding: 0,
    fontSize: 16,
    cursor: "pointer",
    backgroundColor: {
      default: t.surface,
      ":hover": {
        default: t.surface,
        [chatMedia.hover]: t.hover,
      },
    },
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9,
    transform: {
      default: null,
      ":active": {
        default: "scale(0.95)",
        [chatMedia.reducedMotion]: "none",
      },
    },
    transition: {
      default: `transform 150ms ${motion.easeOut}, background-color 150ms ${motion.easeOut}`,
      [chatMedia.reducedMotion]: "background-color 120ms ease",
    },
  },
  presetBtnSelected: {
    backgroundColor: t.hover,
    borderColor: t.primary,
  },
  colorGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: 6,
  },
  hiddenRadio: {
    position: "absolute",
    width: 1,
    height: 1,
    padding: 0,
    margin: -1,
    overflow: "hidden",
    borderWidth: 0,
    clipPath: "inset(50%)",
  },
  colorChip: {
    position: "relative",
    display: "inline-flex",
    gap: 6,
    alignItems: "center",
    height: 30,
    paddingBlock: 0,
    paddingInline: 10,
    fontSize: 12,
    fontWeight: 500,
    color: t.text,
    cursor: "pointer",
    backgroundColor: {
      default: t.surface,
      ":hover": {
        default: t.surface,
        [chatMedia.hover]: t.hover,
      },
    },
    borderColor: t.border,
    borderStyle: "solid",
    borderWidth: 1,
    borderRadius: 9999,
  },
  colorChipSelected: {
    backgroundColor: t.hover,
    borderColor: t.primary,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 9999,
  },
  colorDotNone: {
    width: 10,
    height: 10,
    backgroundColor: "transparent",
    borderColor: t.borderStrong,
    borderStyle: "dashed",
    borderWidth: 1,
    borderRadius: 9999,
  },
});
