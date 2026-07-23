import * as errore from "errore";
import { type } from "arktype";
import type { EncryptCtx } from "./key-ring";
import { KeyRingError } from "./key-ring";

export type { EncryptCtx };

// 暗号化エンベロープエラー（WebCrypto 復号/暗号化失敗、形式不正）
class EnvelopeError extends errore.createTaggedError({
  name: "EnvelopeError",
  message: "$message",
}) {}

// エンベロープの厳格なランタイム検証スキーマ
// - v: フォーマットバージョン（現在 1 のみ）
// - kid: キーID（英数字・ハイフン・アンダースコア、1文字以上）
// - iv: 96-bit IV の hex エンコード（24 hex文字 = 12バイト）
// - ct: 暗号文 + GCM tag の hex エンコード（空でない偶数長）
const ALLOWED_ENVELOPE_KEYS = new Set(["v", "kid", "iv", "ct"]);

export const credentialEnvelopeSchema = type({
  v: "1",
  kid: type.pipe(type("string"), type("string >= 1")),
  iv: /^[0-9a-f]{24}$/,
  ct: /^[0-9a-f]+$/,
});

// バージョン付き暗号化エンベロープ
export type CredentialEnvelope = typeof credentialEnvelopeSchema.infer;

// 暗号化・復号時の AAD バインディング
type AadBinding = {
  sessionHash: string;
  userId: string;
  purpose: "session" | "refresh";
};

const ENVELOPE_VERSION = 1;
const IV_LENGTH = 12; // 96-bit IV
const KID_REGEX = /^[A-Za-z0-9_-]{1,100}$/;

// 受信したエンベロープを厳格に検証
const validateEnvelope = (raw: unknown): CredentialEnvelope | EnvelopeError => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return new EnvelopeError({ message: "エンベロープがオブジェクトではありません。" });
  }
  // 未知フィールドを検証
  for (const key of Object.keys(raw)) {
    if (!ALLOWED_ENVELOPE_KEYS.has(key)) {
      return new EnvelopeError({ message: `エンベロープに未知のフィールドがあります: ${key}` });
    }
  }
  const result = credentialEnvelopeSchema(raw);
  if (result instanceof type.errors) {
    return new EnvelopeError({
      message: "不正なエンベロープ形式です。",
      cause: result,
    });
  }
  // kid の文字種を追加検証
  if (!KID_REGEX.test(result.kid)) {
    return new EnvelopeError({ message: "不正なキーID形式です。" });
  }
  // AES-GCM の認証タグ（16バイト）以上かつ偶数長であることを保証する
  if (result.ct.length < 32 || result.ct.length % 2 !== 0) {
    return new EnvelopeError({ message: "暗号文の長さが不正です。" });
  }
  return result as CredentialEnvelope;
};

// AAD 文字列を構築（sessionHash|userId|purpose|version）
const buildAad = (binding: AadBinding): Uint8Array =>
  new TextEncoder().encode(
    `${binding.sessionHash}|${binding.userId}|${binding.purpose}|${ENVELOPE_VERSION}`,
  );

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

// hex → Uint8Array（厳格な入力検証付き）
const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
};

// クレデンシャルを暗号化し、バージョン付きエンベロープを返す
const encryptCredential = async (
  ctx: EncryptCtx,
  plaintext: string,
  binding: AadBinding,
): Promise<CredentialEnvelope | EnvelopeError | KeyRingError> => {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const aad = buildAad(binding);
  const encoded = new TextEncoder().encode(plaintext);

  const ciphertext = await crypto.subtle
    .encrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer, additionalData: aad.buffer as ArrayBuffer },
      ctx.activeKey,
      encoded.buffer as ArrayBuffer,
    )
    .catch(
      (e) =>
        new EnvelopeError({
          message: "暗号化に失敗しました。",
          cause: e,
        }),
    );
  if (ciphertext instanceof Error) return ciphertext;

  return {
    v: ENVELOPE_VERSION,
    kid: ctx.activeKeyId,
    iv: bytesToHex(iv),
    ct: bytesToHex(new Uint8Array(ciphertext)),
  };
};

// エンベロープを復号し、平文を返す
const decryptCredential = async (
  ctx: EncryptCtx,
  rawEnvelope: unknown,
  binding: AadBinding,
): Promise<string | EnvelopeError | KeyRingError> => {
  // 入力を厳格に検証（TypeScript のキャストに依存しない）
  const validated = validateEnvelope(rawEnvelope);
  if (validated instanceof Error) return validated;

  const keyEntry = ctx.keys.get(validated.kid);
  if (!keyEntry) {
    return new KeyRingError({
      message: "未知の暗号化キーIDです。",
    });
  }

  const aad = buildAad(binding);
  const iv = hexToBytes(validated.iv);
  const ct = hexToBytes(validated.ct);

  const decrypted = await crypto.subtle
    .decrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer, additionalData: aad.buffer as ArrayBuffer },
      keyEntry.cryptoKey,
      ct.buffer as ArrayBuffer,
    )
    .catch(
      (e) =>
        new EnvelopeError({
          message: "復号に失敗しました。",
          cause: e,
        }),
    );
  if (decrypted instanceof Error) return decrypted;

  return new TextDecoder().decode(decrypted);
};

export { encryptCredential, decryptCredential, validateEnvelope };
export type { AadBinding };
