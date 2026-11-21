import { logInfo, logWarning } from "../../lib/log.ts";
import type { DecisionModelAdapter } from "../adapter.ts";
import { decidePopup, DEFAULT_SHALLOW_SINGLE_STRATEGY, DEFAULT_THRESHOLDS } from "../decide.ts";
import { DecisionModelTimeoutError } from "../errors.ts";
import type {
  DecisionThresholds,
  DraftAssistRequest,
  DraftAssistResponse,
  NormalizedDecisionResult,
  ShallowSingleStrategy,
} from "../types.ts";

const DEFAULT_DECISION_TIMEOUT_MS = 1200;

export interface DecisionLogEntry {
  event: "draft_assist_decision";
  draftSessionId: string;
  modelVersion: string;
  latencyMs: number;
  toneType: NormalizedDecisionResult["toneType"];
  elements: NormalizedDecisionResult["elements"];
  concreteDetail: number;
  decidedPopupId: DraftAssistResponse["popupId"];
}

function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T | Error>,
  timeoutMs: number,
): Promise<T | Error> {
  const controller = new AbortController();
  let timerId: ReturnType<typeof setTimeout> | undefined;

  const timeoutPromise = new Promise<DecisionModelTimeoutError>((resolve) => {
    timerId = setTimeout(() => {
      controller.abort();
      resolve(new DecisionModelTimeoutError({ timeoutMs }));
    }, timeoutMs);
  });

  return Promise.race([
    run(controller.signal).finally(() => {
      if (timerId !== undefined) {
        clearTimeout(timerId);
      }
    }),
    timeoutPromise,
  ]);
}

export async function evaluateDraft(deps: {
  adapter: DecisionModelAdapter;
  input: DraftAssistRequest;
  thresholds?: DecisionThresholds;
  shallowSingleStrategy?: ShallowSingleStrategy;
  timeoutMs?: number;
  now?: () => number;
  onLog?: (entry: DecisionLogEntry) => void;
}): Promise<DraftAssistResponse> {
  const now = deps.now ?? Date.now;
  const timeoutMs = deps.timeoutMs ?? DEFAULT_DECISION_TIMEOUT_MS;
  const thresholds = deps.thresholds ?? DEFAULT_THRESHOLDS;
  const shallowSingleStrategy = deps.shallowSingleStrategy ?? DEFAULT_SHALLOW_SINGLE_STRATEGY;
  const startedAt = now();

  const result = await withTimeout(
    (signal) =>
      deps.adapter.evaluate({
        trackTitle: deps.input.trackTitle,
        draftText: deps.input.draftText,
        signal,
      }),
    timeoutMs,
  );

  const latencyMs = Math.max(0, Math.round(now() - startedAt));

  if (result instanceof Error) {
    logWarning("draft-assist decision failed (fail-open)", result);
    return {
      popupId: null,
      modelVersion: deps.adapter.modelVersion,
    };
  }

  const popupId = decidePopup(result, thresholds, shallowSingleStrategy);
  const logEntry: DecisionLogEntry = {
    event: "draft_assist_decision",
    draftSessionId: deps.input.draftSessionId,
    modelVersion: result.modelVersion,
    latencyMs,
    toneType: result.toneType,
    elements: result.elements,
    concreteDetail: result.concreteDetail,
    decidedPopupId: popupId,
  };

  if (deps.onLog) {
    deps.onLog(logEntry);
  } else {
    logInfo(JSON.stringify(logEntry));
  }

  return {
    popupId,
    modelVersion: result.modelVersion,
  };
}
