import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

const { mockUseSearchParams } = vi.hoisted(() => ({
  mockUseSearchParams: vi.fn(() => new URLSearchParams()),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockUseSearchParams(),
}));

// next/link をシンプルな <a> タグとしてモック
vi.mock("next/link", () => ({
  default: ({ href, ...props }: { href: string; [key: string]: unknown }) => {
    return require("react").createElement("a", { href, ...props });
  },
}));

const mockSignInPost = vi.hoisted(() => vi.fn());
const mockSignUpPost = vi.hoisted(() => vi.fn());

vi.mock("@/features/lib/api", () => ({
  api: {
    auth: {
      "sign-in": { $post: mockSignInPost },
      "sign-up": { $post: mockSignUpPost },
      "sign-out": { $post: vi.fn() },
    },
    user: { $get: vi.fn() },
  },
}));

vi.mock("@/env", () => ({
  env: {
    NEXT_PUBLIC_API_URL: "http://localhost:3001",
  },
}));

import { GoogleSignInButton } from "./google-sign-in-button";
import { Auth } from "./auth";

describe("GoogleSignInButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue(new URLSearchParams());
  });

  it("Googleログインボタンが正しいhrefで描画される", () => {
    render(<GoogleSignInButton />);

    const link = screen.getByRole("link", { name: /Google/ });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/api/auth/google");
  });

  it("プレーンなリンク要素として描画される（Firebase SDK不使用）", () => {
    const { container } = render(<GoogleSignInButton />);

    // next/link は <a> タグとして描画される
    const link = container.querySelector("a");
    expect(link).toBeInTheDocument();
    expect(link?.getAttribute("href")).toBe("/api/auth/google");
    // Firebase SDKやGoogle SDKのスクリプトは読み込まれない
    expect(link?.querySelector("script")).toBeNull();
  });

  it.each([
    {
      code: "account_exists",
      message:
        "このメールアドレスは既に別の方法で登録されています。元の方法でログインしてください。",
    },
    {
      code: "invalid_state",
      message: "認証状態が無効です。もう一度お試しください。",
    },
    {
      code: "expired_state",
      message: "ログインセッションが期限切れです。もう一度お試しください。",
    },
    {
      code: "oauth_failed",
      message: "Googleログインに失敗しました。もう一度お試しください。",
    },
    {
      code: "firebase_auth_failed",
      message: "認証に失敗しました。もう一度お試しください。",
    },
  ])(
    "URLパラメータ ?error=$code の場合、適切なエラーメッセージが表示される",
    ({ code, message }) => {
      mockUseSearchParams.mockReturnValue(new URLSearchParams(`error=${code}`));

      render(
        <Auth.Provider>
          <Auth.Error />
        </Auth.Provider>,
      );

      expect(screen.getByText(message)).toBeInTheDocument();
    },
  );

  it("不明なエラーコードの場合はフォールバックメッセージが表示される", () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams("error=unknown_error"));

    render(
      <Auth.Provider>
        <Auth.Error />
      </Auth.Provider>,
    );

    expect(screen.getByText("unknown_error")).toBeInTheDocument();
  });

  it("エラーパラメータがない場合、エラーメッセージは表示されない", () => {
    mockUseSearchParams.mockReturnValue(new URLSearchParams());

    render(
      <Auth.Provider>
        <Auth.Error />
      </Auth.Provider>,
    );

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
