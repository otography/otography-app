import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockPush, mockRefresh, mockPatch } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockPatch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("@/features/lib/api", () => ({
  api: {
    user: {
      profile: {
        $patch: mockPatch,
      },
    },
  },
}));

import { SetupProfileForm } from "./setup-profile-form";

function createPatchResponse(status: number, body?: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(body),
  } as unknown as Response;
}

describe("SetupProfileForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders username and name input fields", () => {
    render(<SetupProfileForm />);

    expect(screen.getByLabelText("Username")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("renders submit button", () => {
    render(<SetupProfileForm />);

    expect(screen.getByRole("button", { name: "Set up profile" })).toBeInTheDocument();
  });

  describe("successful submission", () => {
    it("calls PATCH /api/user/profile with username and name", async () => {
      const user = userEvent.setup();
      mockPatch.mockResolvedValue(createPatchResponse(200, { message: "Profile updated." }));

      render(<SetupProfileForm />);

      await user.type(screen.getByLabelText("Username"), "testuser");
      await user.type(screen.getByLabelText("Name"), "Test User");
      await user.click(screen.getByRole("button", { name: "Set up profile" }));

      expect(mockPatch).toHaveBeenCalledWith({
        json: { username: "testuser", name: "Test User" },
      });
    });

    it("redirects to /account on success", async () => {
      const user = userEvent.setup();
      mockPatch.mockResolvedValue(createPatchResponse(200, { message: "Profile updated." }));

      render(<SetupProfileForm />);

      await user.type(screen.getByLabelText("Username"), "testuser");
      await user.type(screen.getByLabelText("Name"), "Test User");
      await user.click(screen.getByRole("button", { name: "Set up profile" }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith("/account");
      });
    });

    it("calls router.refresh after redirect", async () => {
      const user = userEvent.setup();
      mockPatch.mockResolvedValue(createPatchResponse(200, { message: "Profile updated." }));

      render(<SetupProfileForm />);

      await user.type(screen.getByLabelText("Username"), "testuser");
      await user.type(screen.getByLabelText("Name"), "Test User");
      await user.click(screen.getByRole("button", { name: "Set up profile" }));

      await waitFor(() => {
        expect(mockRefresh).toHaveBeenCalled();
      });
    });
  });

  describe("error handling", () => {
    it("displays error message from API response", async () => {
      const user = userEvent.setup();
      mockPatch.mockResolvedValue(createPatchResponse(400, { message: "Username already taken." }));

      render(<SetupProfileForm />);

      await user.type(screen.getByLabelText("Username"), "taken");
      await user.type(screen.getByLabelText("Name"), "Test");
      await user.click(screen.getByRole("button", { name: "Set up profile" }));

      await waitFor(() => {
        expect(screen.getByText("Username already taken.")).toBeInTheDocument();
      });
    });

    it("displays fallback message when API response has no message", async () => {
      const user = userEvent.setup();
      mockPatch.mockResolvedValue(createPatchResponse(500, {}));

      render(<SetupProfileForm />);

      await user.type(screen.getByLabelText("Username"), "testuser");
      await user.type(screen.getByLabelText("Name"), "Test");
      await user.click(screen.getByRole("button", { name: "Set up profile" }));

      await waitFor(() => {
        expect(screen.getByText("Failed to set up profile.")).toBeInTheDocument();
      });
    });

    it("displays error message when network request fails", async () => {
      const user = userEvent.setup();
      mockPatch.mockRejectedValue(new Error("Network error"));

      render(<SetupProfileForm />);

      await user.type(screen.getByLabelText("Username"), "testuser");
      await user.type(screen.getByLabelText("Name"), "Test");
      await user.click(screen.getByRole("button", { name: "Set up profile" }));

      await waitFor(() => {
        expect(screen.getByText("Unable to reach the server.")).toBeInTheDocument();
      });
    });

    it("does not redirect on error", async () => {
      const user = userEvent.setup();
      mockPatch.mockResolvedValue(createPatchResponse(400, { message: "Validation failed." }));

      render(<SetupProfileForm />);

      await user.type(screen.getByLabelText("Username"), "bad");
      await user.type(screen.getByLabelText("Name"), "Test");
      await user.click(screen.getByRole("button", { name: "Set up profile" }));

      await waitFor(() => {
        expect(screen.getByText("Validation failed.")).toBeInTheDocument();
      });

      expect(mockPush).not.toHaveBeenCalled();
    });
  });

  describe("pending state", () => {
    it("disables submit button while request is in flight", async () => {
      const user = userEvent.setup();
      let resolvePatch!: (value: unknown) => void;
      mockPatch.mockReturnValue(
        new Promise((resolve) => {
          resolvePatch = resolve;
        }),
      );

      render(<SetupProfileForm />);

      await user.type(screen.getByLabelText("Username"), "testuser");
      await user.type(screen.getByLabelText("Name"), "Test");
      await user.click(screen.getByRole("button", { name: "Set up profile" }));

      const button = screen.getByRole("button", { name: "Setting up..." });
      expect(button).toBeDisabled();

      resolvePatch(createPatchResponse(200, { message: "Profile updated." }));

      await waitFor(() => {
        expect(screen.getByRole("button", { name: "Set up profile" })).not.toBeDisabled();
      });
    });
  });
});
