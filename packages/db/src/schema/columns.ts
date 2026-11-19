import { sql } from "drizzle-orm";
import { customType, integer } from "drizzle-orm/sqlite-core";

/** 日時は INTEGER（epoch ミリ秒）で保存し、JS では Date として扱う。 */
export const timestamp = () => integer({ mode: "timestamp_ms" });

export const createdAt = () =>
  timestamp()
    .notNull()
    .$defaultFn(() => new Date());

export const updatedAt = () =>
  timestamp()
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date());

/**
 * バイト列をそのまま保存する BLOB。行列などを Float32Array / Float64Array のバイト列にして入れる。
 * codec "blob" で、読み出しの値を Uint8Array（Node では Buffer）にそろえる。
 */
export const bytes = customType<{ data: Uint8Array; driverData: Uint8Array }>({
  dataType() {
    return "blob";
  },
  codec: "blob",
});

/** IEEE 754 半精度（16bit）を number に戻す。 */
const halfToNumber = (h: number): number => {
  const sign = h & 0x8000 ? -1 : 1;
  const exponent = (h >> 10) & 0x1f;
  const fraction = h & 0x03ff;
  if (exponent === 0) return sign * 2 ** -14 * (fraction / 1024);
  if (exponent === 0x1f) return fraction ? Number.NaN : sign * Number.POSITIVE_INFINITY;
  return sign * 2 ** (exponent - 15) * (1 + fraction / 1024);
};

/**
 * libSQL の F16_BLOB(n)。書き込みは vector16()、読み出しは半精度を展開する。
 * F16_BLOB は「2 バイト × 次元数 + 末尾 1 バイト（型の印）」で保存される。
 *
 * codec "blob" で Drizzle 組み込みの BLOB 用の変換に乗せる。
 * - 通常の SELECT：ドライバーの値を Buffer（Workers など Buffer が無い環境では Uint8Array）にそろえる
 * - リレーショナルクエリ（with）：JSON は BLOB を持てないので hex() で文字列にして取り、バイト列に戻す
 * どちらも fromDriver にはバイト列で届く。hex(NULL) は空文字になるため、この型の列は NOT NULL で使う。
 * 判断の理由は docs/adr/0002-vector-column-blob-codec.md を参照。
 */
export const float16Vector = customType<{
  data: number[];
  config: { dimensions: number };
  configRequired: true;
  driverData: Uint8Array;
}>({
  dataType(config) {
    return `F16_BLOB(${config.dimensions})`;
  },
  codec: "blob",
  toDriver(value) {
    return sql`vector16(${JSON.stringify(value)})`;
  },
  fromDriver(value) {
    const view = new DataView(value.buffer, value.byteOffset, value.byteLength);
    const length = Math.floor(view.byteLength / 2);
    const out = Array.from<number>({ length });
    for (let i = 0; i < length; i++) out[i] = halfToNumber(view.getUint16(i * 2, true));
    return out;
  },
});
