import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { artists, JAPAN_PREFECTURES } from "../../shared/db/schema";

const ARTIST_TYPES = ["person", "group"] as const;

type ArtistType = (typeof ARTIST_TYPES)[number];
type ArtistBirthplace = (typeof JAPAN_PREFECTURES)[number];
type ArtistDbModel = InferSelectModel<typeof artists>;
export type ArtistCreateDbModel = Pick<
  InferInsertModel<typeof artists>,
  "name" | "ipiCode" | "type" | "gender" | "birthplace" | "birthdate"
>;
export type ArtistUpdateDbModel = Partial<ArtistCreateDbModel>;

type Artist = {
  id: ArtistDbModel["id"];
  name: ArtistDbModel["name"];
  ipiCode: ArtistDbModel["ipiCode"];
  type: ArtistDbModel["type"];
  gender: ArtistDbModel["gender"];
  birthplace: ArtistDbModel["birthplace"];
  birthdate: ArtistDbModel["birthdate"];
  createdAt: ArtistDbModel["createdAt"];
  updatedAt: ArtistDbModel["updatedAt"];
};

type ArtistCreateInput = {
  name: string;
  ipiCode?: string;
  type?: ArtistType;
  gender?: string;
  birthplace?: ArtistBirthplace;
  birthdate?: string;
};

type ArtistUpdateInput = {
  name?: string;
  ipiCode?: string | null;
  type?: ArtistType | null;
  gender?: string | null;
  birthplace?: ArtistBirthplace | null;
  birthdate?: string | null;
};

type ArtistCreatePayload = {
  name: string;
  ipiCode?: string;
  type?: string;
  gender?: string;
  birthplace?: string;
  birthdate?: string;
};

type ArtistUpdatePayload = {
  name?: string;
  ipiCode?: string | null;
  type?: string | null;
  gender?: string | null;
  birthplace?: string | null;
  birthdate?: string | null;
};

const isArtistType = (value: string): value is ArtistType => {
  return ARTIST_TYPES.includes(value as ArtistType);
};

const isArtistBirthplace = (value: string): value is ArtistBirthplace => {
  return JAPAN_PREFECTURES.includes(value as ArtistBirthplace);
};

const isIsoDate = (value: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
};

export const validateArtistCreateInput = (input: ArtistCreatePayload) => {
  if (input.type !== undefined && !isArtistType(input.type)) {
    return new Error("Please provide a valid artist type.");
  }

  if (input.birthplace !== undefined && !isArtistBirthplace(input.birthplace)) {
    return new Error("Please provide a valid artist birthplace.");
  }

  if (input.birthdate !== undefined && !isIsoDate(input.birthdate)) {
    return new Error("Please provide a valid artist birthdate.");
  }

  return {
    name: input.name,
    ipiCode: input.ipiCode,
    type: input.type,
    gender: input.gender,
    birthplace: input.birthplace,
    birthdate: input.birthdate,
  } satisfies ArtistCreateInput;
};

const normalizeOptionalString = (value: string | null | undefined) => {
  if (value === undefined || value === null) {
    return value;
  }
  return value.trim();
};

export const toArtist = (model: ArtistDbModel): Artist => {
  return {
    id: model.id,
    name: model.name,
    ipiCode: model.ipiCode,
    type: model.type,
    gender: model.gender,
    birthplace: model.birthplace,
    birthdate: model.birthdate,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
  };
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

export const validateArtistUpdateInput = (input: ArtistUpdatePayload) => {
  const normalizedInput = {
    name: normalizeOptionalString(input.name),
    ipiCode: normalizeOptionalString(input.ipiCode),
    type: input.type,
    gender: normalizeOptionalString(input.gender),
    birthplace: normalizeOptionalString(input.birthplace),
    birthdate: normalizeOptionalString(input.birthdate),
  };

  if (
    normalizedInput.name === undefined &&
    normalizedInput.ipiCode === undefined &&
    normalizedInput.type === undefined &&
    normalizedInput.gender === undefined &&
    normalizedInput.birthplace === undefined &&
    normalizedInput.birthdate === undefined
  ) {
    return new Error("Please provide at least one field to update.");
  }

  if (
    normalizedInput.name !== undefined &&
    normalizedInput.name !== null &&
    normalizedInput.name.length === 0
  ) {
    return new Error("Please provide a valid artist name.");
  }

  if (
    normalizedInput.ipiCode !== undefined &&
    normalizedInput.ipiCode !== null &&
    normalizedInput.ipiCode.length > 20
  ) {
    return new Error("Please provide a valid artist ipi code.");
  }

  if (
    normalizedInput.type !== undefined &&
    normalizedInput.type !== null &&
    !isArtistType(normalizedInput.type)
  ) {
    return new Error("Please provide a valid artist type.");
  }

  if (
    normalizedInput.gender !== undefined &&
    normalizedInput.gender !== null &&
    normalizedInput.gender.length > 20
  ) {
    return new Error("Please provide a valid artist gender.");
  }

  if (
    normalizedInput.birthplace !== undefined &&
    normalizedInput.birthplace !== null &&
    !isArtistBirthplace(normalizedInput.birthplace)
  ) {
    return new Error("Please provide a valid artist birthplace.");
  }

  if (
    normalizedInput.birthdate !== undefined &&
    normalizedInput.birthdate !== null &&
    !isIsoDate(normalizedInput.birthdate)
  ) {
    return new Error("Please provide a valid artist birthdate.");
  }

  return {
    name: normalizedInput.name ?? undefined,
    ipiCode: normalizedInput.ipiCode,
    type: normalizedInput.type as ArtistType | null | undefined,
    gender: normalizedInput.gender,
    birthplace: normalizedInput.birthplace as ArtistBirthplace | null | undefined,
    birthdate: normalizedInput.birthdate,
  } satisfies ArtistUpdateInput;
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
