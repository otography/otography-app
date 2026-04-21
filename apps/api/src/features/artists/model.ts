import type { InferInsertModel, InferSelectModel } from "drizzle-orm";
import { artists } from "../../shared/db/schema";

const ARTIST_TYPES = ["person", "group"] as const;

const ARTIST_BIRTHPLACES = [
  "Hokkaido",
  "Aomori",
  "Iwate",
  "Miyagi",
  "Akita",
  "Yamagata",
  "Fukushima",
  "Ibaraki",
  "Tochigi",
  "Gunma",
  "Saitama",
  "Chiba",
  "Tokyo",
  "Kanagawa",
  "Niigata",
  "Toyama",
  "Ishikawa",
  "Fukui",
  "Yamanashi",
  "Nagano",
  "Gifu",
  "Shizuoka",
  "Aichi",
  "Mie",
  "Shiga",
  "Kyoto",
  "Osaka",
  "Hyogo",
  "Nara",
  "Wakayama",
  "Tottori",
  "Shimane",
  "Okayama",
  "Hiroshima",
  "Yamaguchi",
  "Tokushima",
  "Kagawa",
  "Ehime",
  "Kochi",
  "Fukuoka",
  "Saga",
  "Nagasaki",
  "Kumamoto",
  "Oita",
  "Miyazaki",
  "Kagoshima",
  "Okinawa",
] as const;

type ArtistType = (typeof ARTIST_TYPES)[number];
type ArtistBirthplace = (typeof ARTIST_BIRTHPLACES)[number];
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
  ipiCode?: string;
  type?: ArtistType;
  gender?: string;
  birthplace?: ArtistBirthplace;
  birthdate?: string;
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
  ipiCode?: string;
  type?: string;
  gender?: string;
  birthplace?: string;
  birthdate?: string;
};

const isArtistType = (value: string): value is ArtistType => {
  return ARTIST_TYPES.includes(value as ArtistType);
};

const isArtistBirthplace = (value: string): value is ArtistBirthplace => {
  return ARTIST_BIRTHPLACES.includes(value as ArtistBirthplace);
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
  if (
    input.name === undefined &&
    input.ipiCode === undefined &&
    input.type === undefined &&
    input.gender === undefined &&
    input.birthplace === undefined &&
    input.birthdate === undefined
  ) {
    return new Error("Please provide at least one field to update.");
  }

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
