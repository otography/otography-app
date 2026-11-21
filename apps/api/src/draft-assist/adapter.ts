import {
  DecisionModelConfigError,
  DecisionModelParseError,
  DecisionModelRequestError,
} from "./errors.ts";
import { DRAFT_ASSIST_QUESTIONS } from "./questions.ts";
import type { NormalizedDecisionResult, ToneChoice } from "./types.ts";

interface DecisionModelInput {
  trackTitle: string;
  draftText: string;
  signal?: AbortSignal;
}

export interface DecisionModelAdapter {
  readonly modelVersion: string;
  evaluate: (input: DecisionModelInput) => Promise<NormalizedDecisionResult | Error>;
}

const VALID_TONE_CHOICES: ReadonlyArray<ToneChoice> = [
  "abstract_only",
  "objective_critique",
  "personal_experience",
  "other",
];

type JsonValue =
  | string
  | number
  | boolean
  | null
  | ReadonlyArray<JsonValue>
  | { readonly [key: string]: JsonValue };

type JsonObject = { readonly [key: string]: JsonValue };

type SystemOnePayload = {
  model: string;
  state: {
    track_title: string;
    draft_text: string;
  };
  questions: typeof DRAFT_ASSIST_QUESTIONS;
};

export type RunAiFn = (model: string, payload: SystemOnePayload) => Promise<unknown>;

function isRecord(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isToneChoice(value: unknown): value is ToneChoice {
  return typeof value === "string" && (VALID_TONE_CHOICES as ReadonlyArray<string>).includes(value);
}

function clampUnit(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function parseNoulProbability(raw: unknown): number | null {
  if (typeof raw === "number" && Number.isFinite(raw)) {
    return clampUnit(raw);
  }
  if (!isRecord(raw)) {
    return null;
  }

  for (const key of ["noul", "probability", "true", "yes", "value"] as const) {
    const candidate = raw[key];
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return clampUnit(candidate);
    }
  }

  if (isRecord(raw.probabilities)) {
    const probTrue = raw.probabilities.true ?? raw.probabilities.yes;
    if (typeof probTrue === "number" && Number.isFinite(probTrue)) {
      return clampUnit(probTrue);
    }
  }

  return null;
}

function parseToneChoice(raw: unknown): { choice: ToneChoice; confidence: number } | null {
  if (!isRecord(raw)) {
    return null;
  }

  // 1. probabilities マップから最上位の選択肢を導出する（System One 標準形式）
  if (isRecord(raw.probabilities)) {
    let bestChoice: ToneChoice | null = null;
    let bestProb = -1;
    for (const choice of VALID_TONE_CHOICES) {
      const prob = raw.probabilities[choice];
      if (typeof prob === "number" && Number.isFinite(prob) && prob > bestProb) {
        bestProb = prob;
        bestChoice = choice;
      }
    }
    if (bestChoice !== null && bestProb >= 0) {
      return { choice: bestChoice, confidence: clampUnit(bestProb) };
    }
  }

  // 2. choice / value + confidence / probability の直接形式
  const rawChoice = raw.choice ?? raw.value ?? raw.label;
  const rawConfidence = raw.confidence ?? raw.probability;
  if (
    isToneChoice(rawChoice) &&
    typeof rawConfidence === "number" &&
    Number.isFinite(rawConfidence)
  ) {
    return { choice: rawChoice, confidence: clampUnit(rawConfidence) };
  }

  return null;
}

export function normalizeSystemOneResponse(
  raw: unknown,
  fallbackModelVersion: string,
): NormalizedDecisionResult | DecisionModelParseError {
  if (!isRecord(raw)) {
    return new DecisionModelParseError({ detail: "応答がオブジェクトではありません" });
  }

  const answers = isRecord(raw.answers)
    ? raw.answers
    : isRecord(raw.results)
      ? raw.results
      : isRecord(raw.result) && isRecord(raw.result.answers)
        ? raw.result.answers
        : null;

  if (!answers) {
    return new DecisionModelParseError({ detail: "answers フィールドがありません" });
  }

  const toneType = parseToneChoice(answers.tone_type);
  if (!toneType) {
    return new DecisionModelParseError({ detail: "tone_type を解釈できません" });
  }

  const space = parseNoulProbability(answers.has_space);
  const time = parseNoulProbability(answers.has_time);
  const sound = parseNoulProbability(answers.has_sound);
  const memory = parseNoulProbability(answers.has_memory);
  const emotion = parseNoulProbability(answers.has_emotion_or_action);
  const concreteDetail = parseNoulProbability(answers.has_concrete_detail);

  if (
    space === null ||
    time === null ||
    sound === null ||
    memory === null ||
    emotion === null ||
    concreteDetail === null
  ) {
    return new DecisionModelParseError({ detail: "noul 確率の一部が欠落しています" });
  }

  const modelVersion =
    typeof raw.model === "string" && raw.model.trim() ? raw.model.trim() : fallbackModelVersion;

  return {
    modelVersion,
    toneType,
    elements: { space, time, sound, memory, emotion },
    concreteDetail,
  };
}

function buildSystemOnePayload(model: string, input: DecisionModelInput) {
  return {
    model,
    state: {
      track_title: input.trackTitle,
      draft_text: input.draftText,
    },
    questions: DRAFT_ASSIST_QUESTIONS,
  };
}

export const CLEF_FLASH_WORKERS_AI_MODEL = "@cf/cloudflare/clef-flash";
export const CLEF_FLASH_MODEL_VERSION = "clef-flash";
export const PPLX_DECIDER_MODEL_VERSION = "pplx-decider-flash-v1.3";

export function createClefFlashAdapter(deps: {
  runAi: RunAiFn;
  modelId?: string;
  modelVersion?: string;
}): DecisionModelAdapter {
  const modelId = deps.modelId ?? CLEF_FLASH_WORKERS_AI_MODEL;
  const modelVersion = deps.modelVersion ?? CLEF_FLASH_MODEL_VERSION;

  return {
    modelVersion,
    async evaluate(input) {
      const payload = buildSystemOnePayload(modelVersion, input);
      const raw = await deps
        .runAi(modelId, payload)
        .catch((error: unknown) => new DecisionModelRequestError({ cause: error }));
      if (raw instanceof Error) {
        return raw;
      }
      return normalizeSystemOneResponse(raw, modelVersion);
    },
  };
}

export function createSystemOneHttpAdapter(deps: {
  endpoint: string;
  apiKey?: string;
  modelVersion: string;
  fetchImpl?: typeof fetch;
}): DecisionModelAdapter {
  const fetchImpl = deps.fetchImpl ?? fetch;

  return {
    modelVersion: deps.modelVersion,
    async evaluate(input) {
      const headers = new Headers({
        "Content-Type": "application/json",
      });
      if (deps.apiKey) {
        headers.set("Authorization", `Bearer ${deps.apiKey}`);
      }

      const res = await fetchImpl(deps.endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(buildSystemOnePayload(deps.modelVersion, input)),
        signal: input.signal,
      }).catch((error: unknown) => new DecisionModelRequestError({ cause: error }));
      if (res instanceof Error) {
        return res;
      }

      if (!res.ok) {
        return new DecisionModelRequestError({
          cause: new Error(`System One API returned HTTP ${res.status}`),
        });
      }

      const raw = await res
        .json()
        .catch(
          (error: unknown) =>
            new DecisionModelParseError({ detail: "JSON の解析に失敗", cause: error }),
        );
      if (raw instanceof Error) {
        return raw;
      }

      return normalizeSystemOneResponse(raw, deps.modelVersion);
    },
  };
}

export function resolveDecisionAdapter(deps: {
  env: Record<string, string | undefined>;
  runAi?: RunAiFn;
  fetchImpl?: typeof fetch;
}): DecisionModelAdapter | DecisionModelConfigError {
  const provider = (deps.env.DRAFT_ASSIST_PROVIDER ?? CLEF_FLASH_MODEL_VERSION)
    .trim()
    .toLowerCase();

  if (provider === "pplx-decider" || provider === PPLX_DECIDER_MODEL_VERSION) {
    const endpoint = deps.env.DRAFT_ASSIST_API_URL?.trim();
    if (!endpoint) {
      return new DecisionModelConfigError({
        detail: "pplx-decider を使うには DRAFT_ASSIST_API_URL が必要です",
      });
    }
    const modelVersion = deps.env.DRAFT_ASSIST_MODEL?.trim() || PPLX_DECIDER_MODEL_VERSION;
    return createSystemOneHttpAdapter({
      endpoint,
      apiKey: deps.env.DRAFT_ASSIST_API_KEY?.trim() || undefined,
      modelVersion,
      fetchImpl: deps.fetchImpl,
    });
  }

  if (provider === "clef-flash" || provider === CLEF_FLASH_WORKERS_AI_MODEL) {
    if (!deps.runAi) {
      return new DecisionModelConfigError({
        detail: "Workers AI バインディング (AI) がありません",
      });
    }
    return createClefFlashAdapter({
      runAi: deps.runAi,
      modelId: deps.env.DRAFT_ASSIST_MODEL?.trim() || CLEF_FLASH_WORKERS_AI_MODEL,
      modelVersion: CLEF_FLASH_MODEL_VERSION,
    });
  }

  return new DecisionModelConfigError({ detail: `未対応のプロバイダ: ${provider}` });
}
