import * as errore from "errore";
import { type } from "arktype";

// キーリング設定エラー
class KeyRingError extends errore.createTaggedError({
  name: "KeyRingError",
  message: "$message",
}) {}

// キーリング内の個別キー定義
type KeyRingEntry = {
  id: string;
  hex: string;
  decryptOnly?: boolean;
};

// キーリング全体の設定
type KeyRingConfig = {
  activeKeyId: string;
  keys: KeyRingEntry[];
};

// 検証済みの CryptoKey を保持するエントリ
type ResolvedKey = {
  id: string;
  cryptoKey: CryptoKey;
  decryptOnly: boolean;
};

// 検証済みキーリング（暗号化/復号コンテキスト）
type EncryptCtx = {
  activeKeyId: string;
  activeKey: CryptoKey;
  keys: Map<string, ResolvedKey>;
};

// キーリング JSON の厳格なランタイム検証スキーマ
const keyRingEntrySchema = type({
  id: type.pipe(type("string"), type("string >= 1")),
  hex: /^[0-9a-fA-F]{64}$/,
  "decryptOnly?": "boolean",
});

const ALLOWED_TOP_KEYS = new Set(["v", "activeKeyId", "keys"]);
const ALLOWED_ENTRY_KEYS = new Set(["id", "hex", "decryptOnly"]);

// 未知フィールドを含むキーリングJSONを検証
const parseKeyRingJsonStrict = (raw: unknown): KeyRingConfig | KeyRingError => {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return new KeyRingError({ message: "キーリングJSONの形式が不正です。" });
  }
  const obj = raw as Record<string, unknown>;
  for (const key of Object.keys(obj)) {
    if (!ALLOWED_TOP_KEYS.has(key)) {
      return new KeyRingError({ message: `キーリングJSONに未知のフィールドがあります: ${key}` });
    }
  }

  const result = keyRingJsonSchema(obj);
  if (result instanceof type.errors) {
    return new KeyRingError({
      message: "キーリングJSONの形式が不正です。",
      cause: result,
    });
  }

  // 各キーエントリの未知フィールドを検証
  for (const entry of result.keys) {
    if (typeof entry !== "object" || entry === null) continue;
    for (const key of Object.keys(entry)) {
      if (!ALLOWED_ENTRY_KEYS.has(key)) {
        return new KeyRingError({ message: `キーエントリに未知のフィールドがあります: ${key}` });
      }
    }
  }

  if (result.keys.length === 0) {
    return new KeyRingError({ message: "キーリングには少なくとも1つのキーが必要です。" });
  }

  return { activeKeyId: result.activeKeyId, keys: result.keys as KeyRingEntry[] };
};

const keyRingJsonSchema = type({
  v: "1",
  activeKeyId: type.pipe(type("string"), type("string >= 1")),
  keys: keyRingEntrySchema.array(),
});

const HEX_REGEX = /^[0-9a-fA-F]+$/;
const KEY_HEX_LENGTH = 64; // 32バイト = 64 hex文字
const KEY_ID_REGEX = /^[A-Za-z0-9_-]{1,100}$/;

const parseKeyHex = (hex: string): Uint8Array | KeyRingError => {
  if (hex.length !== KEY_HEX_LENGTH || !HEX_REGEX.test(hex)) {
    return new KeyRingError({
      message: "暗号化キーは64文字のhex文字列（32バイト AES-256）である必要があります。",
    });
  }
  const bytes = new Uint8Array(32);
  for (let i = 0; i < KEY_HEX_LENGTH; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
};

// キーリングを検証し、CryptoKey を事前インポートした EncryptCtx を返す
const validateKeyRing = async (config: KeyRingConfig): Promise<EncryptCtx | KeyRingError> => {
  if (!config.activeKeyId) {
    return new KeyRingError({ message: "アクティブキーIDは空であってはなりません。" });
  }

  if (!KEY_ID_REGEX.test(config.activeKeyId)) {
    return new KeyRingError({ message: "アクティブキーIDの形式が不正です。" });
  }

  if (config.keys.length === 0) {
    return new KeyRingError({ message: "キーリングには少なくとも1つのキーが必要です。" });
  }

  // 重複キーIDの検出 + キーID形式チェック
  const seenIds = new Set<string>();
  for (const key of config.keys) {
    if (!KEY_ID_REGEX.test(key.id)) {
      return new KeyRingError({ message: `キーIDの形式が不正です: ${key.id}` });
    }
    if (seenIds.has(key.id)) {
      return new KeyRingError({ message: `重複するキーID: ${key.id}` });
    }
    seenIds.add(key.id);
  }

  // アクティブキーがリストに存在するか
  const activeEntry = config.keys.find((k) => k.id === config.activeKeyId);
  if (!activeEntry) {
    return new KeyRingError({
      message: `アクティブキーID "${config.activeKeyId}" がキーリングに存在しません。`,
    });
  }

  // アクティブキーが decrypt-only でないことを確認
  if (activeEntry.decryptOnly) {
    return new KeyRingError({
      message: `アクティブキー "${config.activeKeyId}" は decrypt-only に設定できません。`,
    });
  }

  // 全キーをインポート
  const resolvedKeys = new Map<string, ResolvedKey>();
  for (const key of config.keys) {
    const keyBytes = parseKeyHex(key.hex);
    if (keyBytes instanceof Error) return keyBytes;

    const usages: KeyUsage[] = key.decryptOnly ? ["decrypt"] : ["encrypt", "decrypt"];
    const cryptoKey = await crypto.subtle
      .importKey("raw", keyBytes.buffer as ArrayBuffer, { name: "AES-GCM" }, false, usages)
      .catch(
        (e) =>
          new KeyRingError({ message: `キー "${key.id}" のインポートに失敗しました。`, cause: e }),
      );
    if (cryptoKey instanceof Error) return cryptoKey;

    resolvedKeys.set(key.id, {
      id: key.id,
      cryptoKey,
      decryptOnly: Boolean(key.decryptOnly),
    });
  }

  const activeKey = resolvedKeys.get(config.activeKeyId)!.cryptoKey;

  return {
    activeKeyId: config.activeKeyId,
    activeKey,
    keys: resolvedKeys,
  };
};

export { validateKeyRing, parseKeyRingJsonStrict as parseKeyRingJson, KeyRingError };
export type { KeyRingConfig, EncryptCtx };
