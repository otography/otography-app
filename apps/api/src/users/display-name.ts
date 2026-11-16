import { USER_NAME_MAX } from "db";

/**
 * 登録時の表示名（Google のプロフィールの名前）を、DB の CHECK 制約（1〜USER_NAME_MAX 文字）に合わせる。
 * 前後の空白を除き、USER_NAME_MAX 文字（コードポイント）で切る。空なら仮の名前にする。
 */
export const toDisplayName = (name: string | null | undefined) =>
  Array.from((name ?? "").trim())
    .slice(0, USER_NAME_MAX)
    .join("") || "名前未設定";
