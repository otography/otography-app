const HEADER = "-----BEGIN PRIVATE KEY-----";
const FOOTER = "-----END PRIVATE KEY-----";

/**
 * シークレットに登録した .p8 の中身を、jose の importPKCS8 が読める PEM の形に整える。
 * 登録のしかたによって、次のような形で届くことがあるため。
 * - 前後に引用符（"）が付いている（.env の値を引用符ごとコピーした場合）
 * - 改行が \n という 2 文字になっている、または空白に置き換わっている（1 行で登録した場合）
 * 本体（Base64）を取り出し、64 文字ごとに改行して、前後に見出しの行を付け直す。
 * 見出しの行がない場合は、値全体を本体として扱う。
 */
export function normalizePkcs8Pem(value: string) {
  const text = value.replaceAll(String.raw`\n`, "\n");
  const start = text.indexOf(HEADER);
  const end = text.indexOf(FOOTER);
  const inner = start !== -1 && end > start ? text.slice(start + HEADER.length, end) : text;
  const body = inner.replaceAll(/[^A-Za-z0-9+/=]/g, "");
  const lines = body.match(/.{1,64}/g) ?? [];
  return [HEADER, ...lines, FOOTER, ""].join("\n");
}
