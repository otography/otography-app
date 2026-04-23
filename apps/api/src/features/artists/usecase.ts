import {
  createArtist,
  findArtistById,
  listArtists,
  softDeleteArtistById,
  updateArtistById,
} from "./repository";
import { JAPAN_PREFECTURES } from "../../shared/db/schema";
import {
  type ArtistBirthplace,
  type ArtistCreatePayload,
  type ArtistCreateInput,
  type ArtistType,
  type ArtistUpdatePayload,
  type ArtistUpdateInput,
  toArtist,
  toArtistCreateDbModel,
  toArtistUpdateDbModel,
} from "./model";

export class ArtistUsecaseError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.name = "ArtistUsecaseError";
    this.statusCode = statusCode;
  }
}

export const getArtists = async () => {
  const rows = await listArtists();
  if (rows instanceof Error) {
    return new ArtistUsecaseError("Failed to fetch artists.", 500);
  }

  return { artists: rows.map(toArtist) };
};

export const getArtist = async (id: string) => {
  const artist = await findArtistById(id);
  if (artist instanceof Error) {
    return new ArtistUsecaseError("Failed to fetch artist.", 500);
  }
  if (artist === null) {
    return new ArtistUsecaseError("Artist not found.", 404);
  }

  return { artist: toArtist(artist) };
};

const isArtistType = (value: string): value is ArtistType => {
  return value === "person" || value === "group";
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

const normalizeOptionalString = (value: string | null | undefined) => {
  if (value === undefined || value === null) {
    return value;
  }
  return value.trim();
};

const validateArtistCreateInput = (input: ArtistCreatePayload): ArtistCreateInput | Error => {
  if (input.type !== undefined && !isArtistType(input.type)) {
    return new ArtistUsecaseError("Please provide a valid artist type.", 400);
  }

  if (input.birthplace !== undefined && !isArtistBirthplace(input.birthplace)) {
    return new ArtistUsecaseError("Please provide a valid artist birthplace.", 400);
  }

  if (input.birthdate !== undefined && !isIsoDate(input.birthdate)) {
    return new ArtistUsecaseError("Please provide a valid artist birthdate.", 400);
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

export const registerArtist = async (payload: ArtistCreatePayload) => {
  const validPayload = validateArtistCreateInput(payload);
  if (validPayload instanceof Error) {
    return validPayload;
  }

  const rows = await createArtist(toArtistCreateDbModel(validPayload));
  if (rows instanceof Error) {
    return new ArtistUsecaseError("Failed to create artist.", 500);
  }

  const [artist] = rows;
  if (!artist) {
    return new ArtistUsecaseError("Failed to create artist.", 500);
  }

  return { artist: toArtist(artist) };
};

type UpdateArtistInput = {
  id: string;
  payload: ArtistUpdatePayload;
};

const validateArtistUpdateInput = (
  input: UpdateArtistInput["payload"],
): ArtistUpdateInput | Error => {
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
    return new ArtistUsecaseError("Please provide at least one field to update.", 400);
  }

  if (
    normalizedInput.name !== undefined &&
    normalizedInput.name !== null &&
    normalizedInput.name.length === 0
  ) {
    return new ArtistUsecaseError("Please provide a valid artist name.", 400);
  }

  if (
    normalizedInput.ipiCode !== undefined &&
    normalizedInput.ipiCode !== null &&
    normalizedInput.ipiCode.length > 20
  ) {
    return new ArtistUsecaseError("Please provide a valid artist ipi code.", 400);
  }

  if (
    normalizedInput.type !== undefined &&
    normalizedInput.type !== null &&
    !isArtistType(normalizedInput.type)
  ) {
    return new ArtistUsecaseError("Please provide a valid artist type.", 400);
  }

  if (
    normalizedInput.gender !== undefined &&
    normalizedInput.gender !== null &&
    normalizedInput.gender.length > 20
  ) {
    return new ArtistUsecaseError("Please provide a valid artist gender.", 400);
  }

  if (
    normalizedInput.birthplace !== undefined &&
    normalizedInput.birthplace !== null &&
    !isArtistBirthplace(normalizedInput.birthplace)
  ) {
    return new ArtistUsecaseError("Please provide a valid artist birthplace.", 400);
  }

  if (
    normalizedInput.birthdate !== undefined &&
    normalizedInput.birthdate !== null &&
    !isIsoDate(normalizedInput.birthdate)
  ) {
    return new ArtistUsecaseError("Please provide a valid artist birthdate.", 400);
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

export const modifyArtist = async ({ id, payload }: UpdateArtistInput) => {
  const validPayload = validateArtistUpdateInput(payload);
  if (validPayload instanceof Error) {
    return validPayload;
  }

  const updatedArtist = await updateArtistById({
    id,
    values: toArtistUpdateDbModel(validPayload),
  });
  if (updatedArtist instanceof Error) {
    return new ArtistUsecaseError("Failed to update artist.", 500);
  }
  if (updatedArtist === null) {
    return new ArtistUsecaseError("Artist not found.", 404);
  }

  return { artist: toArtist(updatedArtist) };
};

export const removeArtist = async (id: string) => {
  const deletedArtist = await softDeleteArtistById(id);
  if (deletedArtist instanceof Error) {
    return new ArtistUsecaseError("Failed to delete artist.", 500);
  }
  if (deletedArtist === null) {
    return new ArtistUsecaseError("Artist not found.", 404);
  }

  return { deleted: true };
};
