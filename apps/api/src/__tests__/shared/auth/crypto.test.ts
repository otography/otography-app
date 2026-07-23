import { describe, expect, it, vi } from "vitest";

// setup.ts が session-crypto と envelope をモックするため、実モジュールを使用する
vi.unmock("../../../shared/auth/session-crypto");
vi.unmock("../../../shared/auth/envelope");
vi.unmock("../../../shared/auth/key-ring");
vi.unmock("../../../shared/auth/key-ring-loader");

import {
  generateOpaqueSessionId,
  hashSessionId,
  isValidOpaqueCookieValue,
} from "../../../shared/auth/session-crypto";
import {
  validateKeyRing,
  parseKeyRingJson,
  type KeyRingConfig,
} from "../../../shared/auth/key-ring";
import {
  encryptCredential,
  decryptCredential,
  type EncryptCtx,
  type CredentialEnvelope,
  type AadBinding,
} from "../../../shared/auth/envelope";
import { getEncryptCtx } from "../../../shared/auth/key-ring-loader";

describe("generateOpaqueSessionId", () => {
  it("base64url 文字列を生成する（パディングなし）", () => {
    const id = generateOpaqueSessionId();
    expect(typeof id).toBe("string");
    expect(id).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(id).not.toContain("=");
  });

  it("少なくとも256ビット（32バイト）のエントロピーを持つ", () => {
    const id = generateOpaqueSessionId();
    // base64url エンコードで32バイト → 43文字以上
    expect(id.length).toBeGreaterThanOrEqual(43);
  });

  it("呼び出しごとに異なる値を生成する", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 100; i++) {
      ids.add(generateOpaqueSessionId());
    }
    expect(ids.size).toBe(100);
  });
});

describe("hashSessionId", () => {
  it("決定論的な SHA-256 hex を生成する", async () => {
    const id = "test-session-id-12345";
    const hash1 = await hashSessionId(id);
    const hash2 = await hashSessionId(id);
    expect(hash1).toBe(hash2);
    // SHA-256 hex = 64文字
    expect(hash1).toMatch(/^[0-9a-f]{64}$/);
  });

  it("異なる入力で異なるハッシュを生成する", async () => {
    const hash1 = await hashSessionId("session-a");
    const hash2 = await hashSessionId("session-b");
    expect(hash1).not.toBe(hash2);
  });

  it("Web Crypto SHA-256 と一致する", async () => {
    const id = "verify-me";
    const expected = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(id));
    const expectedHex = Array.from(new Uint8Array(expected))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    expect(await hashSessionId(id)).toBe(expectedHex);
  });
});

describe("isValidOpaqueCookieValue", () => {
  it("有効な43文字のbase64url値を受け入れる", () => {
    const id = generateOpaqueSessionId();
    expect(isValidOpaqueCookieValue(id)).toBe(true);
  });

  it("空文字列を拒否する", () => {
    expect(isValidOpaqueCookieValue("")).toBe(false);
  });

  it("短すぎる値を拒否する", () => {
    expect(isValidOpaqueCookieValue("short")).toBe(false);
  });

  it("長すぎる値を拒否する", () => {
    expect(isValidOpaqueCookieValue("a".repeat(44))).toBe(false);
  });

  it("base64url以外の文字（+, /, =）を拒否する", () => {
    expect(isValidOpaqueCookieValue("a".repeat(42) + "=")).toBe(false);
    expect(isValidOpaqueCookieValue("a".repeat(42) + "+")).toBe(false);
    expect(isValidOpaqueCookieValue("a".repeat(42) + "/")).toBe(false);
  });
});

// テスト用の有効な32バイトhex鍵
const VALID_KEY_HEX_1 = "a".repeat(64);
const VALID_KEY_HEX_2 = "b".repeat(64);

describe("parseKeyRingJson", () => {
  it("有効なキーリングJSONを受け入れる", () => {
    const json = { v: 1, activeKeyId: "key-1", keys: [{ id: "key-1", hex: VALID_KEY_HEX_1 }] };
    const result = parseKeyRingJson(json);
    expect(result).not.toBeInstanceOf(Error);
  });

  it("未知のトップレベルフィールドを拒否する", () => {
    const json = {
      v: 1,
      activeKeyId: "key-1",
      keys: [{ id: "key-1", hex: VALID_KEY_HEX_1 }],
      extra: true,
    };
    expect(parseKeyRingJson(json)).toBeInstanceOf(Error);
  });

  it("未知のキーエントリフィールドを拒否する", () => {
    const json = {
      v: 1,
      activeKeyId: "key-1",
      keys: [{ id: "key-1", hex: VALID_KEY_HEX_1, extra: true }],
    };
    expect(parseKeyRingJson(json)).toBeInstanceOf(Error);
  });

  it("空のキーリストを拒否する", () => {
    const json = { v: 1, activeKeyId: "key-1", keys: [] };
    expect(parseKeyRingJson(json)).toBeInstanceOf(Error);
  });
});

describe("validateKeyRing", () => {
  it("有効なアクティブキーのみの設定を受け入れる", () => {
    const config: KeyRingConfig = {
      activeKeyId: "key-1",
      keys: [{ id: "key-1", hex: VALID_KEY_HEX_1 }],
    };
    const result = validateKeyRing(config);
    expect(result).not.toBeInstanceOf(Error);
  });

  it("アクティブ + リタイアキーの設定を受け入れる", () => {
    const config: KeyRingConfig = {
      activeKeyId: "key-2",
      keys: [
        { id: "key-1", hex: VALID_KEY_HEX_1, decryptOnly: true },
        { id: "key-2", hex: VALID_KEY_HEX_2 },
      ],
    };
    const result = validateKeyRing(config);
    expect(result).not.toBeInstanceOf(Error);
  });

  it("空のアクティブキーIDを拒否する", async () => {
    const config = {
      activeKeyId: "",
      keys: [{ id: "key-1", hex: VALID_KEY_HEX_1 }],
    };
    expect(await validateKeyRing(config as KeyRingConfig)).toBeInstanceOf(Error);
  });

  it("アクティブキーIDがキーリストに存在しない場合を拒否する", async () => {
    const config: KeyRingConfig = {
      activeKeyId: "missing-key",
      keys: [{ id: "key-1", hex: VALID_KEY_HEX_1 }],
    };
    expect(await validateKeyRing(config)).toBeInstanceOf(Error);
  });

  it("重複キーIDを拒否する", async () => {
    const config = {
      activeKeyId: "key-1",
      keys: [
        { id: "key-1", hex: VALID_KEY_HEX_1 },
        { id: "key-1", hex: VALID_KEY_HEX_2 },
      ],
    };
    expect(await validateKeyRing(config as KeyRingConfig)).toBeInstanceOf(Error);
  });

  it("不正なhex形式（64文字以外）を拒否する", async () => {
    const config = {
      activeKeyId: "key-1",
      keys: [{ id: "key-1", hex: "short" }],
    };
    expect(await validateKeyRing(config as KeyRingConfig)).toBeInstanceOf(Error);
  });

  it("hex以外の文字を含むキーを拒否する", async () => {
    const config = {
      activeKeyId: "key-1",
      keys: [{ id: "key-1", hex: "g".repeat(64) }],
    };
    expect(await validateKeyRing(config as KeyRingConfig)).toBeInstanceOf(Error);
  });

  it("空のキーリストを拒否する", async () => {
    const config = {
      activeKeyId: "key-1",
      keys: [],
    };
    expect(await validateKeyRing(config as KeyRingConfig)).toBeInstanceOf(Error);
  });
});

describe("getEncryptCtx", () => {
  it("不正なJSONを値エラーとして返す", async () => {
    const result = await getEncryptCtx("not-json");

    expect(result).toBeInstanceOf(Error);
  });

  it("同じキーIDでも鍵素材が変われば新しいCryptoKeyを読み込む", async () => {
    const first = await getEncryptCtx(
      JSON.stringify({
        v: 1,
        activeKeyId: "same-id",
        keys: [{ id: "same-id", hex: VALID_KEY_HEX_1 }],
      }),
    );
    const second = await getEncryptCtx(
      JSON.stringify({
        v: 1,
        activeKeyId: "same-id",
        keys: [{ id: "same-id", hex: VALID_KEY_HEX_2 }],
      }),
    );

    if (first instanceof Error) throw first;
    if (second instanceof Error) throw second;
    expect(second.activeKey).not.toBe(first.activeKey);
  });

  it("Secrets Store bindingからキーリングを取得する", async () => {
    const get = vi.fn(async () =>
      JSON.stringify({
        v: 1,
        activeKeyId: "secret-key",
        keys: [{ id: "secret-key", hex: VALID_KEY_HEX_1 }],
      }),
    );

    const result = await getEncryptCtx({ get });

    expect(result).not.toBeInstanceOf(Error);
    expect(get).toHaveBeenCalledOnce();
  });
});

const createTestKeyRing = (): KeyRingConfig => ({
  activeKeyId: "key-active",
  keys: [
    { id: "key-old", hex: VALID_KEY_HEX_1, decryptOnly: true },
    { id: "key-active", hex: VALID_KEY_HEX_2 },
  ],
});

const createTestCtx = async (): Promise<EncryptCtx> => {
  const keyRing = createTestKeyRing();
  return (await validateKeyRing(keyRing)) as EncryptCtx;
};

describe("encryptCredential / decryptCredential", () => {
  it("暗号化 → 復号のラウンドトリップが成功する", async () => {
    const ctx = await createTestCtx();
    const sessionHash = "abc123session_hash";
    const userId = "uuid-user-123";
    const plaintext = "firebase-session-cookie-value";

    const envelope = await encryptCredential(ctx, plaintext, {
      sessionHash,
      userId,
      purpose: "session",
    });
    expect(envelope).not.toBeInstanceOf(Error);

    const decrypted = await decryptCredential(ctx, envelope, {
      sessionHash,
      userId,
      purpose: "session",
    });
    expect(decrypted).toBe(plaintext);
  });

  it("暗号化は正しいバージョン付きエンベロープを生成する", async () => {
    const ctx = await createTestCtx();
    const envelope = await encryptCredential(ctx, "secret-value", {
      sessionHash: "hash",
      userId: "uid",
      purpose: "session",
    });

    expect(envelope).not.toBeInstanceOf(Error);
    const env = envelope as { v: number; kid: string; iv: string; ct: string };
    expect(env.v).toBe(1);
    expect(env.kid).toBe("key-active");
    expect(env.iv).toMatch(/^[0-9a-f]+$/);
    // IV は12バイト → 24 hex chars
    expect(env.iv).toHaveLength(24);
    expect(env.ct).toBeTruthy();
  });

  it("アクティブキーで暗号化する", async () => {
    const ctx = await createTestCtx();
    const envelope = await encryptCredential(ctx, "secret", {
      sessionHash: "h",
      userId: "u",
      purpose: "session",
    });
    const env = envelope as { kid: string };
    expect(env.kid).toBe("key-active");
  });

  it("AAD セッションハッシュが改ざんされた場合、復号に失敗する", async () => {
    const ctx = await createTestCtx();
    const envelope = await encryptCredential(ctx, "secret", {
      sessionHash: "original-hash",
      userId: "uid",
      purpose: "session",
    });
    const result = await decryptCredential(ctx, envelope as never, {
      sessionHash: "tampered-hash",
      userId: "uid",
      purpose: "session",
    });
    expect(result).toBeInstanceOf(Error);
  });

  it("AAD ユーザーID が改ざんされた場合、復号に失敗する", async () => {
    const ctx = await createTestCtx();
    const envelope = await encryptCredential(ctx, "secret", {
      sessionHash: "h",
      userId: "original-user",
      purpose: "session",
    });
    const result = await decryptCredential(ctx, envelope as never, {
      sessionHash: "h",
      userId: "different-user",
      purpose: "session",
    });
    expect(result).toBeInstanceOf(Error);
  });

  it("AAD パーパスが改ざんされた場合、復号に失敗する", async () => {
    const ctx = await createTestCtx();
    const envelope = await encryptCredential(ctx, "secret", {
      sessionHash: "h",
      userId: "u",
      purpose: "session",
    });
    const result = await decryptCredential(ctx, envelope as never, {
      sessionHash: "h",
      userId: "u",
      purpose: "refresh",
    });
    expect(result).toBeInstanceOf(Error);
  });

  it("暗号文が改ざんされた場合、復号に失敗する", async () => {
    const ctx = await createTestCtx();
    const envelope = await encryptCredential(ctx, "secret", {
      sessionHash: "h",
      userId: "u",
      purpose: "session",
    });
    const env = { ...(envelope as CredentialEnvelope) };
    // hexの最後の1文字を変更
    env.ct = env.ct.slice(0, -2) + (env.ct.slice(-2) === "00" ? "01" : "00");
    const result = await decryptCredential(ctx, env, {
      sessionHash: "h",
      userId: "u",
      purpose: "session",
    });
    expect(result).toBeInstanceOf(Error);
  });

  it("リタイアキー（decrypt-only）で暗号化されたデータを復号できる", async () => {
    // key-old で暗号化 → 復号可能
    const keyRing: KeyRingConfig = {
      activeKeyId: "key-active",
      keys: [
        { id: "key-old", hex: VALID_KEY_HEX_1, decryptOnly: true },
        { id: "key-active", hex: VALID_KEY_HEX_2 },
      ],
    };
    const ctx = (await validateKeyRing(keyRing)) as EncryptCtx;

    // key-old の CryptoKey を直接使って暗号化（テスト用）
    const oldKeyBytes = hexToBytes(VALID_KEY_HEX_1);
    const oldKey = await crypto.subtle.importKey(
      "raw",
      oldKeyBytes.buffer as ArrayBuffer,
      { name: "AES-GCM" },
      false,
      ["encrypt", "decrypt"],
    );

    const aad = new TextEncoder().encode("h|u|session|1");
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: iv.buffer as ArrayBuffer, additionalData: aad.buffer as ArrayBuffer },
      oldKey,
      new TextEncoder().encode("old-secret").buffer as ArrayBuffer,
    );

    const oldEnvelope: CredentialEnvelope = {
      v: 1,
      kid: "key-old",
      iv: Array.from(iv)
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
      ct: Array.from(new Uint8Array(ct))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join(""),
    };

    const decrypted = await decryptCredential(ctx, oldEnvelope, {
      sessionHash: "h",
      userId: "u",
      purpose: "session",
    });
    expect(decrypted).toBe("old-secret");
  });

  it("キーリングに存在しないキーIDで復号に失敗する", async () => {
    const ctx = await createTestCtx();
    const fakeEnvelope: CredentialEnvelope = {
      v: 1,
      kid: "nonexistent",
      iv: "00".repeat(12),
      ct: "00",
    };
    const result = await decryptCredential(ctx, fakeEnvelope, {
      sessionHash: "h",
      userId: "u",
      purpose: "session",
    });
    expect(result).toBeInstanceOf(Error);
  });
});

describe("エンベロープ厳格検証", () => {
  const testBinding: AadBinding = {
    sessionHash: "test-hash",
    userId: "test-user",
    purpose: "session",
  };

  it("不正なIV長（24 hex文字以外）を拒否する", async () => {
    const ctx = await createTestCtx();
    const badEnvelope = { v: 1, kid: "key-active", iv: "ab", ct: "00" };
    const result = await decryptCredential(ctx, badEnvelope, testBinding);
    expect(result).toBeInstanceOf(Error);
  });

  it("空の暗号文を拒否する", async () => {
    const ctx = await createTestCtx();
    const badEnvelope = { v: 1, kid: "key-active", iv: "00".repeat(12), ct: "" };
    const result = await decryptCredential(ctx, badEnvelope, testBinding);
    expect(result).toBeInstanceOf(Error);
  });

  it("奇数長の暗号文を拒否する", async () => {
    const ctx = await createTestCtx();
    const badEnvelope = { v: 1, kid: "key-active", iv: "00".repeat(12), ct: "abc" };
    const result = await decryptCredential(ctx, badEnvelope, testBinding);
    expect(result).toBeInstanceOf(Error);
  });

  it("サポートされていないバージョンを拒否する", async () => {
    const ctx = await createTestCtx();
    const badEnvelope = { v: 2, kid: "key-active", iv: "00".repeat(12), ct: "00" };
    const result = await decryptCredential(ctx, badEnvelope, testBinding);
    expect(result).toBeInstanceOf(Error);
  });

  it("未知のフィールドを含むエンベロープを拒否する", async () => {
    const ctx = await createTestCtx();
    const badEnvelope = { v: 1, kid: "key-active", iv: "00".repeat(12), ct: "00", extra: true };
    const result = await decryptCredential(ctx, badEnvelope, testBinding);
    expect(result).toBeInstanceOf(Error);
  });

  it("非オブジェクトの入力を拒否する", async () => {
    const ctx = await createTestCtx();
    const result = await decryptCredential(ctx, null, testBinding);
    expect(result).toBeInstanceOf(Error);
  });

  it("配列入力を拒否する", async () => {
    const ctx = await createTestCtx();
    const result = await decryptCredential(ctx, [1, 2, 3], testBinding);
    expect(result).toBeInstanceOf(Error);
  });
});

// hex → Uint8Array
const hexToBytes = (hex: string): Uint8Array => {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substring(i, i + 2), 16);
  }
  return bytes;
};
