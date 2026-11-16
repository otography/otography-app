import { users } from "db";
import { createSelectSchema } from "drizzle-orm/zod";

/**
 * GET /api/me が返す項目。users の列の型から作る。
 * pick に無い列（内部 ID、利用停止・退会の日時など）は、parse したときに取り除かれる。
 */
export const meSchema = createSelectSchema(users, {
  // Better Auth の型では undefined になり得る。JSON では undefined の項目が消えるので、null にそろえる。
  image: (schema) => schema.nullish().transform((value) => value ?? null),
  bio: (schema) => schema.nullish().transform((value) => value ?? null),
}).pick({ name: true, email: true, image: true, publicId: true, bio: true });
