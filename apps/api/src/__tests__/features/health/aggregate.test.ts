import { describe, expect, it } from "vitest";
import { aggregateStatus, type HealthChecks } from "../../../features/health/aggregate";
import type { CheckResult } from "../../../features/health/checks/types";

const ok = (): CheckResult => ({ status: "ok", latencyMs: 1 });
const unhealthy = (): CheckResult => ({ status: "unhealthy", latencyMs: 1, error: "boom" });
const degraded = (): CheckResult => ({ status: "degraded", latencyMs: 1 });

const healthyChecks: HealthChecks = {
  database: ok(),
  firebase: ok(),
  appleMusic: ok(),
};

describe("aggregateStatus", () => {
  it("全dep正常時: ok と200を返す", () => {
    const result = aggregateStatus(healthyChecks);

    expect(result).toEqual({ status: "ok", httpStatus: 200 });
  });

  it("DBがunhealthy（critical）: unhealthyと503を返す", () => {
    const result = aggregateStatus({ ...healthyChecks, database: unhealthy() });

    expect(result).toEqual({ status: "unhealthy", httpStatus: 503 });
  });

  it("Firebaseがunhealthy（critical）: unhealthyと503を返す", () => {
    const result = aggregateStatus({ ...healthyChecks, firebase: unhealthy() });

    expect(result).toEqual({ status: "unhealthy", httpStatus: 503 });
  });

  it("Apple Musicがdegraded（non-critical）: degradedだが200を返す", () => {
    const result = aggregateStatus({ ...healthyChecks, appleMusic: degraded() });

    expect(result).toEqual({ status: "degraded", httpStatus: 200 });
  });

  it("criticalがunhealthy かつ non-criticalがdegraded: unhealthyと503を優先する", () => {
    const result = aggregateStatus({
      ...healthyChecks,
      database: unhealthy(),
      appleMusic: degraded(),
    });

    expect(result).toEqual({ status: "unhealthy", httpStatus: 503 });
  });
});
