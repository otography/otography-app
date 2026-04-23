import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { artists } from "../../shared/db/schema";

export const ARTIST_TYPES = ["person", "group"] as const;

export type ArtistType = (typeof ARTIST_TYPES)[number];
type ArtistDbModel = InferSelectModel<typeof artists>;
type Artist = Omit<ArtistDbModel, "deletedAt">;

export type ArtistCreateDbModel = Omit<
  InferInsertModel<typeof artists>,
  "id" | "createdAt" | "updatedAt" | "deletedAt"
>;
export type ArtistUpdateDbModel = Partial<ArtistCreateDbModel>;

export type ArtistBirthplace = NonNullable<ArtistCreateDbModel["birthplace"]>;

type ArtistCreatePayloadBase = Omit<ArtistCreateDbModel, "type" | "birthplace" | "birthdate">;
export type ArtistCreatePayload = ArtistCreatePayloadBase & {
  type?: string;
  birthplace?: string;
  birthdate?: string;
};

type ArtistUpdatePayloadBase = Partial<
  Omit<ArtistCreateDbModel, "type" | "birthplace" | "birthdate" | "ipiCode" | "gender">
>;
export type ArtistUpdatePayload = ArtistUpdatePayloadBase & {
  ipiCode?: string | null;
  type?: string | null;
  gender?: string | null;
  birthplace?: string | null;
  birthdate?: string | null;
};

type ArtistCreateInputBase = Omit<ArtistCreateDbModel, "type" | "birthplace" | "birthdate">;
export type ArtistCreateInput = ArtistCreateInputBase & {
  type?: ArtistType;
  birthplace?: ArtistBirthplace;
  birthdate?: string;
};

type ArtistUpdateInputBase = Partial<
  Omit<ArtistCreateDbModel, "type" | "birthplace" | "birthdate">
>;
export type ArtistUpdateInput = ArtistUpdateInputBase & {
  type?: ArtistType | null;
  birthplace?: ArtistBirthplace | null;
  birthdate?: string | null;
};

export const toArtist = (model: ArtistDbModel): Artist => {
  const { deletedAt: _deletedAt, ...artist } = model;
  return artist;
};

export const toArtistCreateDbModel = (input: ArtistCreateInput): ArtistCreateDbModel => {
  return {
    name: input.name,
    ipiCode: input.ipiCode,
    type: input.type,
    gender: input.gender,
    birthplace: input.birthplace,
    birthdate: input.birthdate,
  };
};

export const toArtistUpdateDbModel = (input: ArtistUpdateInput): ArtistUpdateDbModel => {
  return {
    name: input.name,
    ipiCode: input.ipiCode,
    type: input.type,
    gender: input.gender,
    birthplace: input.birthplace,
    birthdate: input.birthdate,
  };
};
