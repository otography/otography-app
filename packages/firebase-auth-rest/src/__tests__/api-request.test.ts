/**
 * HttpClient / AuthorizedHttpClient / ApiSettings テスト
 *
 * オリジナル: test/unit/utils/api-request.spec.ts
 * 適応: nock → fetch mock, HTTP2 テスト除外, multipart テスト除外,
 *       chai/sinon → vitest
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  HttpClient,
  AuthorizedHttpClient,
  ApiSettings,
  ApiCallbackFunction,
} from "../utils/api-request";
import { createMockApp } from "./helpers/mocks";

// ---- 定数 ----

const mockHost = "www.example.com";
const mockPath = "/foo/bar";
const mockUrl = `https://${mockHost}${mockPath}`;

// ===================================================================
// HttpClient
// ===================================================================

describe("HttpClient", () => {
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ---- 基本 GET ----

  it("should be fulfilled for a 2xx response with a json payload", async () => {
    const respData = { foo: "bar" };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(respData), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = new HttpClient();
    const resp = await client.send({ method: "GET", url: mockUrl });

    expect(resp.status).toBe(200);
    expect(resp.headers["content-type"]).toBe("application/json");
    expect(resp.data).toEqual(respData);
    expect(resp.isJson()).toBe(true);
  });

  it("should be fulfilled for a 2xx response with a text payload", async () => {
    const respData = "foo bar";
    fetchSpy.mockResolvedValueOnce(
      new Response(respData, {
        status: 200,
        headers: { "content-type": "text/plain" },
      }),
    );

    const client = new HttpClient();
    const resp = await client.send({ method: "GET", url: mockUrl });

    expect(resp.status).toBe(200);
    expect(resp.text).toBe(respData);
    expect(resp.isJson()).toBe(false);
  });

  // ---- POST ----

  it("should make a POST request with provided headers and data", async () => {
    const reqData = { request: "data" };
    const respData = { success: true };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(respData), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = new HttpClient();
    const resp = await client.send({
      method: "POST",
      url: mockUrl,
      headers: {
        Authorization: "Bearer token",
        "My-Custom-Header": "CustomValue",
      },
      data: reqData,
    });

    expect(resp.status).toBe(200);
    expect(resp.data).toEqual(respData);

    // fetch が正しい引数で呼ばれたことを検証
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    const [fetchUrl, fetchInit] = fetchSpy.mock.calls[0]!;
    expect(fetchUrl).toBe(mockUrl);
    expect(fetchInit.method).toBe("POST");
    expect(fetchInit.headers).toMatchObject({
      Authorization: "Bearer token",
      "My-Custom-Header": "CustomValue",
    });
    expect(JSON.parse(fetchInit.body as string)).toEqual(reqData);
  });

  // ---- エラーレスポンス ----

  it("should fail with RequestResponseError for a 4xx response", async () => {
    const data = { error: "data" };
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify(data), {
        status: 400,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = new HttpClient();
    try {
      await client.send({ method: "GET", url: mockUrl });
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.message).toContain("400");
      expect(err.response.status).toBe(400);
      expect(err.response.data).toEqual(data);
    }
  });

  it("should fail with RequestResponseError for a 5xx response", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ error: "data" }), {
        status: 500,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = new HttpClient();
    try {
      await client.send({ method: "GET", url: mockUrl });
      expect.fail("Should have thrown");
    } catch (err: any) {
      expect(err.response.status).toBe(500);
    }
  });

  // ---- ネットワークエラー ----

  it("should fail for a network error", async () => {
    fetchSpy.mockRejectedValueOnce(new TypeError("Failed to fetch"));

    const client = new HttpClient();
    await expect(client.send({ method: "GET", url: mockUrl })).rejects.toThrow("Failed to fetch");
  });

  // ---- リトライ: 503 → 200 ----

  it("should succeed after a retry on a 503 error", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({}), {
        status: 503,
        headers: { "content-type": "application/json" },
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ foo: "bar" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const origSetTimeout = globalThis.setTimeout;
    globalThis.setTimeout = ((fn: () => void) => fn() as any) as any;

    try {
      const client = new HttpClient();
      const resp = await client.send({ method: "GET", url: mockUrl });
      expect(resp.status).toBe(200);
      expect(resp.data).toEqual({ foo: "bar" });
      expect(fetchSpy).toHaveBeenCalledTimes(2);
    } finally {
      globalThis.setTimeout = origSetTimeout;
    }
  });

  // ---- 無効なペイロード ----

  it("should reject if the request payload is invalid (number)", async () => {
    const client = new HttpClient();
    await expect(client.send({ method: "POST", url: mockUrl, data: 1 as any })).rejects.toThrow(
      "must be a string, a Buffer, or an object",
    );
  });
});

// ===================================================================
// AuthorizedHttpClient
// ===================================================================

describe("AuthorizedHttpClient", () => {
  let mockApp: ReturnType<typeof createMockApp>;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockApp = createMockApp();
    fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should include Authorization header in requests", async () => {
    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ foo: "bar" }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = new AuthorizedHttpClient(mockApp as any);
    const resp = await client.send({ method: "GET", url: mockUrl });
    expect(resp.status).toBe(200);

    // Authorization ヘッダーの検証
    const [, fetchInit] = fetchSpy.mock.calls[0]!;
    expect((fetchInit.headers as Record<string, string>)["Authorization"]).toMatch(/^Bearer /);
  });

  it("should make a POST request with provided headers and data", async () => {
    const reqData = { request: "data" };

    fetchSpy.mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "content-type": "application/json" },
      }),
    );

    const client = new AuthorizedHttpClient(mockApp as any);
    const resp = await client.send({
      method: "POST",
      url: mockUrl,
      headers: { "My-Custom-Header": "CustomValue" },
      data: reqData,
    });

    expect(resp.status).toBe(200);

    const [, fetchInit] = fetchSpy.mock.calls[0]!;
    const headers = fetchInit.headers as Record<string, string>;
    expect(headers["Authorization"]).toMatch(/^Bearer /);
    expect(headers["My-Custom-Header"]).toBe("CustomValue");
  });
});

// ===================================================================
// ApiSettings
// ===================================================================

describe("ApiSettings", () => {
  describe("Constructor", () => {
    it("should succeed with a specified endpoint and default http method", () => {
      expect(() => new ApiSettings("getAccountInfo")).not.toThrow();
    });

    it("should succeed with a specified endpoint and http method", () => {
      expect(() => new ApiSettings("getAccountInfo", "POST")).not.toThrow();
    });

    it("should populate default http method when not specified", () => {
      const apiSettings = new ApiSettings("getAccountInfo");
      expect(apiSettings.getHttpMethod()).toBe("POST");
    });
  });

  describe("Getters and Setters", () => {
    it("should resolve endpoint and http method", () => {
      const apiSettings = new ApiSettings("getAccountInfo", "GET");
      expect(apiSettings.getEndpoint()).toBe("getAccountInfo");
      expect(apiSettings.getHttpMethod()).toBe("GET");
    });

    it("should not return null for unset requestValidator", () => {
      const apiSettings = new ApiSettings("getAccountInfo", "GET");
      expect(apiSettings.getRequestValidator()).not.toBeNull();
      expect(() => apiSettings.getRequestValidator()({})).not.toThrow();
    });

    it("should not return null for unset responseValidator", () => {
      const apiSettings = new ApiSettings("getAccountInfo", "GET");
      expect(apiSettings.getResponseValidator()).not.toBeNull();
      expect(() => apiSettings.getResponseValidator()({})).not.toThrow();
    });

    it("should not return null validators even when set to null", () => {
      const apiSettings = new ApiSettings("getAccountInfo", "GET");
      apiSettings.setRequestValidator(null);
      apiSettings.setResponseValidator(null);
      expect(() => apiSettings.getRequestValidator()({})).not.toThrow();
      expect(() => apiSettings.getResponseValidator()({})).not.toThrow();
    });

    it("should return the correct validators when set", () => {
      const apiSettings = new ApiSettings("getAccountInfo", "GET");
      const requestValidator: ApiCallbackFunction = () => undefined;
      const responseValidator: ApiCallbackFunction = () => undefined;
      apiSettings.setRequestValidator(requestValidator);
      apiSettings.setResponseValidator(responseValidator);
      expect(apiSettings.getRequestValidator()).toBe(requestValidator);
      expect(apiSettings.getResponseValidator()).toBe(responseValidator);
    });
  });
});
