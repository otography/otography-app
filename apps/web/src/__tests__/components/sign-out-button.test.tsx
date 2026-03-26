import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const { mockPush, mockRefresh } = vi.hoisted(() => ({
	mockPush: vi.fn(),
	mockRefresh: vi.fn(),
}));

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: mockPush,
		refresh: mockRefresh,
		replace: vi.fn(),
		back: vi.fn(),
		prefetch: vi.fn(),
	}),
	useSearchParams: () => new URLSearchParams(),
}));

const mockSignOutPost = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({
	api: {
		auth: { "sign-out": { $post: mockSignOutPost } },
		user: { $get: vi.fn() },
	},
}));

import { SignOutButton } from "../../app/sign-out-button";

function mockOkResponse() {
	return { ok: true as const, json: () => Promise.resolve({ message: "Signed out." }) };
}

function mockErrorResponse(message?: string) {
	return { ok: false as const, json: () => Promise.resolve(message ? { message } : null) };
}

describe("SignOutButton", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("success", () => {
		it("navigates to /login and refreshes on successful sign-out", async () => {
			mockSignOutPost.mockResolvedValue(mockOkResponse());
			const user = userEvent.setup();

			render(<SignOutButton />);
			await user.click(screen.getByRole("button", { name: "Sign out" }));

			await waitFor(() => {
				expect(mockPush).toHaveBeenCalledWith("/login");
				expect(mockRefresh).toHaveBeenCalledOnce();
			});
		});

		it("shows pending state while signing out, then re-enables", async () => {
			let resolveResponse!: (value: unknown) => void;
			mockSignOutPost.mockReturnValue(
				new Promise((resolve) => {
					resolveResponse = resolve;
				}),
			);
			const user = userEvent.setup();

			render(<SignOutButton />);
			await user.click(screen.getByRole("button", { name: "Sign out" }));

			expect(screen.getByRole("button", { name: "Signing out..." })).toBeDisabled();

			resolveResponse(mockOkResponse());
			await waitFor(() => {
				expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
			});
		});
	});

	describe("error display", () => {
		it("shows server error message", async () => {
			mockSignOutPost.mockResolvedValue(mockErrorResponse("Failed to sign you out."));
			const user = userEvent.setup();

			render(<SignOutButton />);
			await user.click(screen.getByRole("button", { name: "Sign out" }));

			await waitFor(() => {
				expect(screen.getByText("Failed to sign you out.")).toBeInTheDocument();
			});
		});

		it("shows default error when server response has no message", async () => {
			mockSignOutPost.mockResolvedValue(mockErrorResponse());
			const user = userEvent.setup();

			render(<SignOutButton />);
			await user.click(screen.getByRole("button", { name: "Sign out" }));

			await waitFor(() => {
				expect(screen.getByText("Failed to sign out.")).toBeInTheDocument();
			});
		});

		it("shows default error when json parsing fails", async () => {
			mockSignOutPost.mockResolvedValue({
				ok: false as const,
				json: () => Promise.reject(new Error("parse error")),
			});
			const user = userEvent.setup();

			render(<SignOutButton />);
			await user.click(screen.getByRole("button", { name: "Sign out" }));

			await waitFor(() => {
				expect(screen.getByText("Failed to sign out.")).toBeInTheDocument();
			});
		});

		it("shows network error message", async () => {
			mockSignOutPost.mockRejectedValue(new Error("Network error"));
			const user = userEvent.setup();

			render(<SignOutButton />);
			await user.click(screen.getByRole("button", { name: "Sign out" }));

			await waitFor(() => {
				expect(screen.getByText("Unable to reach the authentication API.")).toBeInTheDocument();
			});
		});

		it("clears previous error on retry", async () => {
			mockSignOutPost.mockResolvedValue(mockErrorResponse("First error"));
			const user = userEvent.setup();

			render(<SignOutButton />);
			await user.click(screen.getByRole("button", { name: "Sign out" }));

			await waitFor(() => {
				expect(screen.getByText("First error")).toBeInTheDocument();
			});

			mockSignOutPost.mockResolvedValue(mockOkResponse());
			await user.click(screen.getByRole("button", { name: "Sign out" }));

			await waitFor(() => {
				expect(screen.queryByText("First error")).not.toBeInTheDocument();
				expect(mockPush).toHaveBeenCalledWith("/login");
			});
		});
	});
});
