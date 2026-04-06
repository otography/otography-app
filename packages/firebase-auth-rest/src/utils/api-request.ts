/*!
 * @license
 * Copyright 2017 Google LLC
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { FirebaseApp } from "../app/firebase-app";
import { AppErrorCodes, FirebaseAppError } from "./error";
import { getMetricsHeader } from "./index";
import * as validator from "./validator";

/** Http method type definition. */
export type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";
/** API callback function type definition. */
export type ApiCallbackFunction = (data: object) => void;

/**
 * Base configuration for constructing a new request.
 */
export interface BaseRequestConfig {
  method: HttpMethod;
  url: string;
  headers?: { [key: string]: string };
  data?: string | object | Buffer | null;
  timeout?: number;
}

/**
 * Configuration for constructing an HTTP request.
 */
export type HttpRequestConfig = BaseRequestConfig;

/**
 * API settings for an API endpoint.
 */
export class ApiSettings {
  private requestValidator!: ApiCallbackFunction;
  private responseValidator!: ApiCallbackFunction;

  constructor(
    private endpoint: string,
    private httpMethod: HttpMethod = "POST",
  ) {
    this.setRequestValidator(null).setResponseValidator(null);
  }

  /** @returns The backend API endpoint. */
  public getEndpoint(): string {
    return this.endpoint;
  }

  /** @returns The request HTTP method. */
  public getHttpMethod(): HttpMethod {
    return this.httpMethod;
  }

  /**
   * @param requestValidator - The request validator.
   * @returns The current API settings instance.
   */
  public setRequestValidator(requestValidator: ApiCallbackFunction | null): ApiSettings {
    const nullFunction: ApiCallbackFunction = () => undefined;
    this.requestValidator = requestValidator || nullFunction;
    return this;
  }

  /** @returns The request validator. */
  public getRequestValidator(): ApiCallbackFunction {
    return this.requestValidator;
  }

  /**
   * @param responseValidator - The response validator.
   * @returns The current API settings instance.
   */
  public setResponseValidator(responseValidator: ApiCallbackFunction | null): ApiSettings {
    const nullFunction: ApiCallbackFunction = () => undefined;
    this.responseValidator = responseValidator || nullFunction;
    return this;
  }

  /** @returns The response validator. */
  public getResponseValidator(): ApiCallbackFunction {
    return this.responseValidator;
  }
}

/**
 * HTTP レスポンス
 */
class ApiResponse {
  public readonly status: number;
  public readonly headers: { [key: string]: string };
  public readonly data: any;
  public readonly text: string;

  constructor(resp: {
    status: number;
    headers: { [key: string]: string };
    data: any;
    text: string;
  }) {
    this.status = resp.status;
    this.headers = resp.headers;
    this.data = resp.data;
    this.text = resp.text;
  }

  public isJson(): boolean {
    return typeof this.data === "object" && this.data !== null;
  }
}

/**
 * HTTP レスポンスエラー
 */
export class RequestResponseError extends Error {
  public readonly response: ApiResponse;

  constructor(response: ApiResponse) {
    super(`Server responded with status ${response.status}.\n${response.text}`);
    Object.setPrototypeOf(this, RequestResponseError.prototype);
    this.response = response;
  }
}

/** リトライ設定 */
interface RetryConfig {
  maxRetries: number;
  maxDelayInMillis: number;
}

/** デフォルトリトライ設定: 最大4回、最大遅延60秒 */
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 4,
  maxDelayInMillis: 60000,
};

/** リトライ対象HTTPステータスコード */
const RETRYABLE_STATUS_CODES = new Set([503]);

/** リトライ対象I/Oエラー名 (fetchエラー) */
const RETRYABLE_ERROR_NAMES = new Set(["AbortError", "TypeError"]);

/**
 * 指数バックオフ遅延を計算。
 * delay = (2^attempt) * 0.5秒, 最大maxDelay
 */
function calculateBackoffDelay(attempt: number, maxDelay: number): number {
  const delay = Math.pow(2, attempt) * 500;
  return Math.min(delay, maxDelay);
}

/**
 * Retry-After ヘッダーから遅延を取得（秒またはHTTP日付）。
 */
function getRetryAfterDelay(headers: { [key: string]: string }, maxDelay: number): number | null {
  const retryAfter = headers["retry-after"];
  if (!retryAfter) {
    return null;
  }

  // 数値の場合は秒として扱う
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return Math.min(seconds * 1000, maxDelay);
  }

  // HTTP-dateの場合はDateとしてパース
  const date = Date.parse(retryAfter);
  if (!isNaN(date)) {
    const delay = date - Date.now();
    return delay > 0 ? Math.min(delay, maxDelay) : null;
  }

  return null;
}

/**
 * fetch-based HTTP client。
 * 指数バックオフリトライ + Retry-After対応。
 */
export class HttpClient {
  public async send(config: HttpRequestConfig): Promise<ApiResponse> {
    return this.sendWithRetry(config);
  }

  private async sendWithRetry(
    config: HttpRequestConfig,
    retryConfig: RetryConfig = DEFAULT_RETRY_CONFIG,
  ): Promise<ApiResponse> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const response = await this.sendOnce(config);

        // 成功
        if (response.status < 400) {
          return response;
        }

        // リトライ対象外のエラー
        if (!RETRYABLE_STATUS_CODES.has(response.status)) {
          throw new RequestResponseError(response);
        }

        // リトライ回数超過
        if (attempt >= retryConfig.maxRetries) {
          throw new RequestResponseError(response);
        }

        // Retry-Afterまたは指数バックオフ
        const delay =
          getRetryAfterDelay(response.headers, retryConfig.maxDelayInMillis) ??
          calculateBackoffDelay(attempt, retryConfig.maxDelayInMillis);

        lastError = new RequestResponseError(response);
        await new Promise((resolve) => setTimeout(resolve, delay));
      } catch (err: unknown) {
        if (err instanceof RequestResponseError) {
          throw err;
        }

        // ネットワークエラーのリトライ
        const errorName = (err as any)?.name;
        if (!RETRYABLE_ERROR_NAMES.has(errorName) || attempt >= retryConfig.maxRetries) {
          if ((err as any)?.name === "AbortError") {
            throw new FirebaseAppError(
              AppErrorCodes.NETWORK_TIMEOUT,
              `Error while making request: ${config.url}. Error: Request timed out.`,
            );
          }
          throw new FirebaseAppError(
            AppErrorCodes.NETWORK_ERROR,
            `Error while making request: ${config.url}. Error: ${(err as Error)?.message ?? String(err)}.`,
          );
        }

        lastError = err as Error;
        const delay = calculateBackoffDelay(attempt, retryConfig.maxDelayInMillis);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // ここには到達しないはずだが、安全のため
    throw lastError ?? new FirebaseAppError(AppErrorCodes.NETWORK_ERROR, "Unknown error");
  }

  private async sendOnce(config: HttpRequestConfig): Promise<ApiResponse> {
    const { method, url, headers = {}, data, timeout = 10000 } = config;

    const fetchHeaders: { [key: string]: string } = {
      "Content-Type": "application/json",
      "X-Client-Version": getMetricsHeader(),
      ...headers,
    };

    let body: string | Uint8Array | undefined;
    if (data !== undefined && data !== null && method !== "GET" && method !== "HEAD") {
      if (typeof data === "string") {
        body = data;
      } else if (validator.isBuffer(data)) {
        body = new Uint8Array(data);
      } else if (typeof data === "object") {
        body = JSON.stringify(data);
      } else {
        throw new FirebaseAppError(
          AppErrorCodes.INVALID_ARGUMENT,
          "Request payload must be a string, a Buffer, or an object.",
        );
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    let response: globalThis.Response;
    try {
      response = await fetch(url, {
        method,
        headers: fetchHeaders,
        body: body as BodyInit | undefined,
        signal: controller.signal,
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        throw new FirebaseAppError(
          AppErrorCodes.NETWORK_TIMEOUT,
          `Error while making request: ${url}. Error: Request timed out.`,
        );
      }
      throw new FirebaseAppError(
        AppErrorCodes.NETWORK_ERROR,
        `Error while making request: ${url}. Error: ${err?.message || err}.`,
      );
    } finally {
      clearTimeout(timeoutId);
    }

    const responseText = await response.text();
    const responseHeaders: { [key: string]: string } = {};
    response.headers.forEach((value, key) => {
      responseHeaders[key] = value;
    });

    // 常にJSON parseを試行（content-typeに依存しない）
    let responseData: any = responseText;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      // JSON parseに失敗した場合はtextのまま
    }

    return new ApiResponse({
      status: response.status,
      headers: responseHeaders,
      data: responseData,
      text: responseText,
    });
  }
}

/**
 * 認証付き HTTP client (Authorization header 自動注入)
 */
export class AuthorizedHttpClient {
  protected readonly httpClient: HttpClient;
  protected readonly app: FirebaseApp;

  constructor(app: FirebaseApp) {
    this.app = app;
    this.httpClient = new HttpClient();
  }

  public async send(config: HttpRequestConfig): Promise<ApiResponse> {
    const token = await this.getToken();
    const headers = { ...config.headers };
    headers["Authorization"] = `Bearer ${token}`;

    // x-goog-user-project: Service Accountにquota_project_idが
    // 明示的に設定されている場合のみ送信。元のgoogle-auth-libraryと同じ挙動。

    return this.httpClient.send({
      ...config,
      headers,
    });
  }

  public async getToken(): Promise<string> {
    const token = await this.app.INTERNAL.getToken();
    return token.accessToken;
  }
}
