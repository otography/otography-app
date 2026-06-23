import { render, screen } from "@testing-library/react";
import { NoProfileError, UnauthenticatedError } from "@repo/errors";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("@/features/auth", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

import Home from "./page";

async function renderHome() {
  return render(await Home());
}

describe("Home", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(new UnauthenticatedError());
  });

  it("renders the landing page sections and primary call to action", async () => {
    await renderHome();

    expect(screen.getByRole("heading", { name: "Music is passed on in words." })).toBeVisible();
    expect(screen.getByText("聴いた人の言葉をまとって、曲は次の誰かへ渡っていく。")).toBeVisible();
    expect(screen.getByRole("heading", { name: "感想がつなぐ、音楽との出会い。" })).toBeVisible();
    expect(screen.getByRole("heading", { name: "いろんな人の、いろんな聴き方。" })).toBeVisible();
    expect(screen.getAllByRole("link", { name: "無料ではじめる" })[0]).toHaveAttribute(
      "href",
      "/login",
    );
  });

  it("uses the supplied landing page assets in the experience", async () => {
    const { container } = await renderHome();

    expect(container.querySelector('img[src*="lp-asset-1.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src*="lp-asset-2.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src*="lp-asset-3.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src*="lp-asset-4.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src*="lp-asset-5.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src*="lp-asset-7.png"]')).toBeInTheDocument();
    expect(container.querySelector('img[src*="lp-asset-8.webp"]')).toBeInTheDocument();
    expect(container.querySelector('img[src*="lp-asset-9.png"]')).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "夜を偉いはたして のジャケット" })).toBeVisible();
    expect(screen.getByRole("img", { name: "ミラー のジャケット" })).toBeVisible();
  });

  it("points the primary call to action at the next authenticated step", async () => {
    mockGetCurrentUser.mockResolvedValue(new NoProfileError());
    await renderHome();

    expect(screen.getAllByRole("link", { name: "無料ではじめる" })[0]).toHaveAttribute(
      "href",
      "/setup-profile",
    );
  });
});
