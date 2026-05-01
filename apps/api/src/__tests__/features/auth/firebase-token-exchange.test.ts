import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.unmock("../../../shared/firebase/firebase-token-exchange");

import { exchangeRefreshToken } from "../../../shared/firebase/firebase-token-exchange";

const mockFetch = vi.fn();
const originalFetch = globalThis.fetch;
vi.stubGlobal("fetch", mockFetch);

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe("exchangeRefreshToken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("preserves JSON parse failure as cause while returning generic token exchange error", async () => {
    mockFetch.mockResolvedValueOnce(
      new Response("not-json", { status: 400, headers: { "Content-Type": "application/json" } }),
    );

    const result = await exchangeRefreshToken("api-key", "refresh-token");

    expect(result).toBeInstanceOf(Error);
    if (result instanceof Error) {
      expect(result.message).toBe("Token exchange failed.");
      expect((result.cause as { _tag?: string } | undefined)?._tag).toBe("AuthRestError");
      expect((result.cause as Error | undefined)?.cause).toBeInstanceOf(Error);
    }
  });
});
