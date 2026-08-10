import type { ProblemSlug } from "@repo/errors";
import { STATUS_ERROR_TYPES, type StatusTypeDefinition } from "./registry/http-error-types";
import {
  ERROR_TYPES,
  type ErrorSlug,
  type ErrorTypeDefinition,
} from "./registry/domain-error-types";
import {
  POSTGRES_CONSTRAINTS,
  type ConstraintDefinition,
  type PostgresConstraintName,
} from "./registry/postgres-constraints";

export { STATUS_ERROR_TYPES } from "./registry/http-error-types";
export { ERROR_TYPES, type ErrorSlug } from "./registry/domain-error-types";
export { POSTGRES_CONSTRAINTS, type PostgresConstraintName } from "./registry/postgres-constraints";

/**
 * slug からエントリを検索するインデックス
 */
const slugIndex = new Map<string, ErrorTypeDefinition>(
  ERROR_TYPES.map((entry) => [entry.slug, entry]),
);

const statusSlugIndex = new Map<string, StatusTypeDefinition>(
  STATUS_ERROR_TYPES.map((entry) => [entry.slug, entry]),
);

const constraintIndex = new Map<string, ConstraintDefinition>(
  POSTGRES_CONSTRAINTS.map((entry) => [entry.constraintName, entry]),
);

/**
 * slug でエントリを取得する
 */
export const getBySlug = (slug: string): ErrorTypeDefinition | undefined => {
  return slugIndex.get(slug);
};

export const getProblemType = (slug: ProblemSlug): ErrorTypeDefinition | StatusTypeDefinition => {
  return slugIndex.get(slug) ?? statusSlugIndex.get(slug)!;
};

export const findProblemType = (
  slug: string,
): ErrorTypeDefinition | StatusTypeDefinition | undefined => {
  return slugIndex.get(slug) ?? statusSlugIndex.get(slug);
};

/**
 * 全 slug の配列を返す
 */
export const getAllSlugs = (): ErrorSlug[] => {
  return ERROR_TYPES.map((entry) => entry.slug);
};

export const getProblemTypeUri = (slug: ProblemSlug): string => {
  return getProblemType(slug).typeUri;
};

export const getPostgresConstraint = (
  constraintName: PostgresConstraintName,
): ConstraintDefinition => {
  return constraintIndex.get(constraintName)!;
};

export const findPostgresConstraint = (
  constraintName: string,
): ConstraintDefinition | undefined => {
  return constraintIndex.get(constraintName);
};
