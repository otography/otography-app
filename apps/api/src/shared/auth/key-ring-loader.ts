import * as errore from "errore";
import { env } from "cloudflare:workers";
import { validateKeyRing, parseKeyRingJson, type EncryptCtx, KeyRingError } from "./key-ring";
import type { Bindings } from "../types/bindings";

// Cloudflare Secrets Store シークレットバインディングの型
// 本番: SecretsStoreSecret（.get() で値を取得）
// ローカル/vitest: string（直接値）
type KeyRingBinding = Bindings["AUTH_SESSION_KEY_RING"];

// キーリングキャッシュエントリ — CryptoKey はキーIDごとにキャッシュし、
// バインディング値の再取得で Secrets Store のローテーションを検出できる
type CachedKeyRing = {
  configFingerprint: string; // キー素材を含む設定全体の SHA-256（非可逆）
  ctx: EncryptCtx;
};

let cached: CachedKeyRing | null = null;

// バインディングからキーリングJSON文字列を取得
const fetchBindingValue = async (binding: KeyRingBinding): Promise<string | KeyRingError> => {
  if (typeof binding === "string") return binding;
  return binding.get().catch(
    (e) =>
      new KeyRingError({
        message: "Secrets Store からキーリングを取得できませんでした。",
        cause: e,
      }),
  );
};

// AUTH_SESSION_KEY_RING バインディングを取得（Secrets Store または文字列）
const getKeyRingBinding = (): KeyRingBinding | KeyRingError => {
  const binding = (env as unknown as Bindings).AUTH_SESSION_KEY_RING;
  if (binding === undefined) {
    return new KeyRingError({
      message: "AUTH_SESSION_KEY_RING バインディングが設定されていません。",
    });
  }
  if (typeof binding === "string") return binding;
  if (
    typeof binding === "object" &&
    binding !== null &&
    typeof (binding as { get?: unknown }).get === "function"
  ) {
    return binding as { get: () => Promise<string> };
  }
  return new KeyRingError({ message: "AUTH_SESSION_KEY_RING の型が不正です。" });
};

const bytesToHex = (bytes: Uint8Array): string =>
  Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

// 同じ key ID の鍵素材が更新された場合も検知できるよう、設定全体を不可逆に指紋化する。
const computeFingerprint = async (json: string) => {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json)).catch(
    (cause) =>
      new KeyRingError({
        message: "キーリング設定の指紋計算に失敗しました。",
        cause,
      }),
  );
  if (digest instanceof Error) return digest;
  return bytesToHex(new Uint8Array(digest));
};

// キーリングを初期化して EncryptCtx を返す
// バインディング値を毎回取得し、CryptoKey は指紋でキャッシュする。
// これにより Secrets Store のローテーションが再デプロイなしで反映される。
export const getEncryptCtx = async (
  bindingOverride?: KeyRingBinding,
): Promise<EncryptCtx | KeyRingError> => {
  const binding = bindingOverride ?? getKeyRingBinding();
  if (binding instanceof Error) return binding;

  const jsonStr = await fetchBindingValue(binding);
  if (jsonStr instanceof Error) return jsonStr;

  const parsed = errore.try({
    try: () => JSON.parse(jsonStr) as Record<string, unknown>,
    catch: (e) =>
      new KeyRingError({
        message: "AUTH_SESSION_KEY_RING JSON のパースに失敗しました。",
        cause: e,
      }),
  });
  if (parsed instanceof Error) return parsed;

  const config = parseKeyRingJson(parsed);
  if (config instanceof Error) return config;

  // キャッシュヒット判定: 指紋が同じなら CryptoKey を再利用
  const fingerprint = await computeFingerprint(jsonStr);
  if (fingerprint instanceof Error) return fingerprint;
  if (cached && cached.configFingerprint === fingerprint) {
    return cached.ctx;
  }

  const ctx = await validateKeyRing(config);
  if (ctx instanceof Error) return ctx;

  cached = { configFingerprint: fingerprint, ctx };
  return ctx;
};
