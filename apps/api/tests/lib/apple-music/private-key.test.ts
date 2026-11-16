import * as jose from "jose";
import { beforeAll, describe, expect, test } from "vite-plus/test";
import { normalizePkcs8Pem } from "../../../src/lib/apple-music/private-key.ts";

let pem = "";

beforeAll(async () => {
  // .p8 と同じ形式（P-256 の PKCS#8）の鍵をテストのたびに作る。
  const { privateKey } = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  pem = await jose.exportPKCS8(privateKey);
});

const canImport = (value: string) =>
  jose.importPKCS8(normalizePkcs8Pem(value), "ES256").then(
    () => true,
    () => false,
  );

describe("normalizePkcs8Pem", () => {
  test("そのままの PEM を読める", async () => {
    expect(await canImport(pem)).toBe(true);
  });

  test("前後に引用符や空白が付いていても読める", async () => {
    expect(await canImport(`"${pem}"`)).toBe(true);
    expect(await canImport(`  ${pem}\n\n`)).toBe(true);
  });

  test("改行が \\n の 2 文字や空白になっていても読める", async () => {
    expect(await canImport(pem.replaceAll("\n", "\\n"))).toBe(true);
    expect(await canImport(pem.replaceAll("\n", " "))).toBe(true);
  });

  test("見出しの行がなく、本体だけでも読める", async () => {
    const body = pem
      .split("\n")
      .filter((line) => line && !line.startsWith("-----"))
      .join("");
    expect(await canImport(body)).toBe(true);
  });
});
