/**
 * firebase-admin-rest テスト用モック・ヘルパー
 *
 * オリジナルの test/resources/mocks.ts をベースに、jose + vitest 環境に適応。
 * jsonwebtoken (Node.js) → jose (Web Crypto) に置換。
 */

import * as jose from "jose";

// ---- 定数 ----

export const uid = "someUid";
export const projectId = "project_id";
const appName = "mock-app-name";

export const ONE_HOUR_IN_SECONDS = 60 * 60;

// ---- 鍵ペア (テスト用に事前生成されたもの) ----

// mock.key.json と同一の秘密鍵
export const mockPrivateKeyPem = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAwJENcRev+eXZKvhhWLiV3Lz2MvO+naQRHo59g3vaNQnbgyduN/L4krlr
J5c6FiikXdtJNb/QrsAHSyJWCu8j3T9CruiwbidGAk2W0RuViTVspjHUTsIHExx9euWM0Uom
GvYkoqXahdhPL/zViVSJt+Rt8bHLsMvpb8RquTIb9iKY3SMV2tCofNmyCSgVbghq/y7lKORt
V/IRguWs6R22fbkb0r2MCYoNAbZ9dqnbRIFNZBC7itYtUoTEresRWcyFMh0zfAIJycWOJlVL
DLqkY2SmIx8u7fuysCg1wcoSZoStuDq02nZEMw1dx8HGzE0hynpHlloRLByuIuOAfMCCYwID
AQABAoIBADFtihu7TspAO0wSUTpqttzgC/nsIsNn95T2UjVLtyjiDNxPZLUrwq42tdCFur0x
VW9Z+CK5x6DzXWvltlw8IeKKeF1ZEOBVaFzy+YFXKTz835SROcO1fgdjyrme7lRSShGlmKW/
GKY+baUNquoDLw5qreXaE0SgMp0jt5ktyYuVxvhLDeV4omw2u6waoGkifsGm8lYivg5l3VR7
w2IVOvYZTt4BuSYVwOM+qjwaS1vtL7gv0SUjrj85Ja6zERRdFiITDhZw6nsvacr9/+/aut9E
aL/koSSb62g5fntQMEwoT4hRnjPnAedmorM9Rhddh2TB3ZKTBbMN1tUk3fJxOuECgYEA+z6l
eSaAcZ3qvwpntcXSpwwJ0SSmzLTH2RJNf+Ld3eBHiSvLTG53dWB7lJtF4R1KcIwf+KGcOFJv
snepzcZBylRvT8RrAAkV0s9OiVm1lXZyaepbLg4GGFJBPi8A6VIAj7zYknToRApdW0s1x/XX
ChewfJDckqsevTMovdbg8YkCgYEAxDYX+3mfvv/opo6HNNY3SfVunM+4vVJL+n8gWZ2w9kz3
Q9Ub9YbRmI7iQaiVkO5xNuoG1n9bM+3Mnm84aQ1YeNT01YqeyQsipP5Wi+um0PzYTaBw9RO+
8Gh6992OwlJiRtFk5WjalNWOxY4MU0ImnJwIfKQlUODvLmcixm68NYsCgYEAuAqI3jkk55Vd
KvotREsX5wP7gPePM+7NYiZ1HNQL4Ab1f/bTojZdTV8Sx6YCR0fUiqMqnE+OBvfkGGBtw22S
Lesx6sWf99Ov58+x4Q0U5dpxL0Lb7d2Z+2Dtp+Z4jXFjNeeI4ae/qG/LOR/b0pE0J5F415ap
7Mpq5v89vepUtrkCgYAjMXytu4v+q1Ikhc4UmRPDrUUQ1WVSd+9u19yKlnFGTFnRjej86hiw
H3jPxBhHra0a53EgiilmsBGSnWpl1WH4EmJz5vBCKUAmjgQiBrueIqv9iHiaTNdjsanUyaWw
jyxXfXl2eI80QPXh02+8g1H/pzESgjK7Rg1AqnkfVH9nrwKBgQDJVxKBPTw9pigYMVt9iHrR
iCl9zQVjRMbWiPOc0J56+/5FZYm/AOGl9rfhQ9vGxXZYZiOP5FsNkwt05Y1UoAAH4B4VQwbL
qod71qOcI0ywgZiIR87CYw40gzRfjWnN+YEEW1qfyoNLilEwJB8iB/T+ZePHGmJ4MmQ/cTn9
xpdLXA==
-----END RSA PRIVATE KEY-----`;

export const mockPrivateKeyKid = "aaaaaaaaaabbbbbbbbbbccccccccccdddddddddd";

// 非対応鍵ペア (署名検証の失敗テスト用)
const mismatchPrivateKeyPem = `-----BEGIN RSA PRIVATE KEY-----
MIIEpAIBAAKCAQEAzhI/CMRtNO45R0DD4NBXFRDYAjlB/UVGGdMJKbCIrD3Uq7r/ivedqRYU
IccOqpeYeu9IH9iotkKq8TM0eCJAUr9WT0o5YzpGvaB8ut87xLh8SqK42VmYAvemUjI257Lt
Dbmshoqzqt9Yq0sgC05b7L3r2xDTxnefeMUHYBwaerCr8PTBCu7NjK3eIWHGPouEwT46WoUp
noNmxdI16CoSMqtuxteG8c14qJbGR9AZujkRDntWOuL1m5KaUIc7XcAaXBt4FiPwoDoQmmCm
ydVCjln3YwSrvL60iAQM6pzCxNRrJRWPYd2u7fgjir/W88w5KHOvdbUyemZWnd6SBExHuQID
AQABAoIBAQDJ9iv9BbYaGBfe82SGIuoV5Uou87ru5EPN73yddTydwoN6Q21L316PZuoYKKUB
IE36viSrwYWoCzLJ7etQihEMiCWo1A/mZikKlA1qgHptVHnMFCqiKiLHVbuV90zETCH0P7MM
sUdhAkA+sQQY0JVbMs/DBXzomDic/k06LpDtCBNdjL7UIT5KyFbBqit+cV6H91Ujqg8MmzrU
tOSw+63oSqZJkT6WPuA/NJNXqtFF+0aOKNX1ttrrTzSDhyp6AxOO7Wm++dpYBtcfnOc3EG65
ul9PfKsJwVZFVO+AAZwdLCeKjtCtWeJc/yXvSj2NTsjs3FKJkRAmmiMp5tH+vbE5AoGBAOhn
KTXGI+ofA3iggByt2InCU+YIXsw1EbbhH4LGB8yyUA2SIjZybwUMKCkoMxmEumFP/FWgOL2w
LlClqf9vZg9dBy8bDINJHm+9roYRO0/EhHA6IDSC+0X5BPZOexrBI07HJI7w7Y0WHFU8jK53
55ps2YGT20n7haRMbbPMrq/3AoGBAOL+pY8bgCnKmeG2inun4FuD+0/aXAySXi70/BAABeHH
pogEfc0jv5SgygTiuC/2T84Jmsg0Y6M2l86srMrMA07xtyMbfRq7zih+K+EDoQ9HAwhDqxX5
M7E8fPXscDzH2Y361QiGAQpjUcMix3hDV8oK537rYOmCYku18ZsVkjnPAoGAbE1u4fVlVTyA
tJ0vNq45Q/GAgamS690rVStSMPIyPk02iyx3ryHi5NpGeO+X6KN269SHhiu1ZYiN/N1G/Jeg
WzaCG4yiZygS/AXMKAQtvL2a7mXYDkCf8nrauiHWsqAg4RxiyA401dPg/kPKV5/fGZLyRbVu
sup43BkV4n1XRv8CgYAmUIE1dJjfdPkgZiVd1epCyDZFNkBPRu1q06MwODDF+WMcllV9qMkP
l0xCItqgDd1Ok8RygpVG2VIqam8IFAOC8b3NyTgGqSiVISba5jfrUjsqy/E21kdpZSJaiDwx
pjIMiwgmVigazsTgQSCWJhfNXKXSgHxtLbrVuLI9URjLdQKBgQDProyaG7pspt6uUdqMTa4+
GVkUg+gIt5aVTf/Lb25K3SHA1baPamtbTDDf6vUjeJtTG+O+RMGqK5mB2MywjVHJdMGcJ44e
ogIh9eWY450oUoVBjEsdUd7Ef5KcpMFDUVFJwzCY371+Loqh2KYAk8WUSRzwGuw2QtLPO/L/
QkKj4Q==
-----END RSA PRIVATE KEY-----`;

const developerClaims = {
  one: "uno",
  two: "dos",
};

// ---- 鍵のインポート (キャッシュ付き) ----

let _privateCryptoKey: CryptoKey | null = null;
let _publicKeyPem: string | null = null;
let _mismatchPublicKeyPem: string | null = null;

/**
 * PEM 秘密鍵を PKCS#8 に変換して jose にインポート。
 * Firebase service account keys は PKCS#1 の場合があるため、
 * node:crypto の createPrivateKey で変換する。
 */
import crypto from "crypto";

function toPkcs8Pem(pem: string): string {
  if (/-----BEGIN RSA PRIVATE KEY-----/.test(pem)) {
    const key = crypto.createPrivateKey({ key: pem, format: "pem" });
    return key.export({ format: "pem", type: "pkcs8" }) as string;
  }
  return pem;
}

async function getPrivateCryptoKey(): Promise<CryptoKey> {
  if (!_privateCryptoKey) {
    _privateCryptoKey = await jose.importPKCS8(toPkcs8Pem(mockPrivateKeyPem), "RS256");
  }
  return _privateCryptoKey;
}

export async function getPublicKeyPem(): Promise<string> {
  if (!_publicKeyPem) {
    // node:crypto で公開鍵PEMを直接導出（PKCS#1 → SPKI PEM）
    const privateKey = crypto.createPrivateKey({
      key: toPkcs8Pem(mockPrivateKeyPem),
      format: "pem",
    });
    const publicKey = crypto.createPublicKey(privateKey);
    _publicKeyPem = publicKey.export({ format: "pem", type: "spki" }) as string;
  }
  return _publicKeyPem!;
}

export async function getMismatchPublicKeyPem(): Promise<string> {
  if (!_mismatchPublicKeyPem) {
    const privateKey = crypto.createPrivateKey({
      key: toPkcs8Pem(mismatchPrivateKeyPem),
      format: "pem",
    });
    const publicKey = crypto.createPublicKey(privateKey);
    _mismatchPublicKeyPem = publicKey.export({ format: "pem", type: "spki" }) as string;
  }
  return _mismatchPublicKeyPem!;
}

// ---- JWT 生成 (jose 版) ----

interface TokenOverrides {
  algorithm?: string;
  header?: Record<string, string>;
  audience?: string;
  expiresIn?: string | number;
  issuer?: string;
  subject?: string;
}

/**
 * jose を使ってモック Firebase ID トークンを生成する。
 * オリジナルの mocks.generateIdToken() に相当。
 */
export async function generateIdToken(
  overrides?: TokenOverrides,
  extraClaims?: Record<string, unknown>,
): Promise<string> {
  const options = {
    aud: overrides?.audience ?? projectId,
    expireIn: overrides?.expiresIn ?? `${ONE_HOUR_IN_SECONDS}s`,
    iss: overrides?.issuer ?? `https://securetoken.google.com/${projectId}`,
    sub: overrides?.subject ?? uid,
    alg: overrides?.algorithm ?? "RS256",
    kid: overrides?.header?.kid ?? mockPrivateKeyKid,
  };

  const payload = {
    ...developerClaims,
    iat: Math.floor(Date.now() / 1000) - 1,
    ...extraClaims,
  };

  const key =
    options.alg === "none"
      ? await getPrivateCryptoKey() // none の場合でも署名は不要だが jose では扱いが異なる
      : options.alg === "RS384"
        ? await getPrivateCryptoKey()
        : await getPrivateCryptoKey();

  if (options.alg === "none") {
    // unsigned (emulator) トークン: ヘッダーの alg を none にして署名なしで手動構築
    const header = { alg: "none", typ: "JWT", ...overrides?.header };
    const encoder = new TextEncoder();
    const headerB64 = jose.base64url.encode(encoder.encode(JSON.stringify(header)));
    const payloadB64 = jose.base64url.encode(encoder.encode(JSON.stringify(payload)));
    return `${headerB64}.${payloadB64}.`;
  }

  let signer = new jose.SignJWT(payload as Record<string, unknown>)
    .setProtectedHeader({ alg: options.alg as string, kid: options.kid, typ: "JWT" })
    .setAudience(options.aud)
    .setIssuer(options.iss)
    .setSubject(options.sub)
    .setIssuedAt(payload.iat);

  if (typeof options.expireIn === "string") {
    signer = signer.setExpirationTime(options.expireIn);
  } else {
    signer = signer.setExpirationTime(payload.iat + (options.expireIn as number));
  }

  return signer.sign(key);
}

// ---- モック FirebaseApp ----

interface MockFirebaseApp {
  options: {
    credential?: {
      getAccessToken: () => Promise<{ access_token: string; expires_in: number }>;
    };
    projectId?: string;
    [key: string]: any;
  };
  name: string;
  delete: () => Promise<void>;
  INTERNAL: {
    getToken: () => Promise<{ accessToken: string } | null>;
  };
}

export function createMockApp(overrides?: Partial<MockFirebaseApp["options"]>): MockFirebaseApp {
  const options: MockFirebaseApp["options"] = {
    credential: {
      getAccessToken: async () => ({ access_token: "mock-access-token", expires_in: 3600 }),
    },
    projectId,
    databaseURL: "https://databaseName.firebaseio.com",
    ...overrides,
  };

  return {
    options,
    name: appName,
    delete: async () => {},
    INTERNAL: {
      getToken: async () => ({ accessToken: "mock-access-token" }),
    },
  };
}
