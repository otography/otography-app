import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("next/navigation", () => ({
	useRouter: () => ({
		push: vi.fn(),
		refresh: vi.fn(),
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

vi.mock("@/env", () => ({
	env: {
		NEXT_PUBLIC_API_URL: "http://localhost:3001",
	},
}));

import { SignOutButton } from "./sign-out-button";

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
		it("completes sign-out and re-enables button without showing errors", async () => {
			mockSignOutPost.mockResolvedValue(mockOkResponse());
			const user = userEvent.setup();

			render(<SignOutButton />);
			await user.click(screen.getByRole("button", { name: "Sign out" }));

			await waitFor(() => {
				expect(screen.getByRole("button", { name: "Sign out" })).toBeEnabled();
			});
			expect(screen.queryByText("Failed to sign out.")).not.toBeInTheDocument();
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

		it("shows fallback error when server returns no usable message", async () => {
			mockSignOutPost.mockResolvedValue(mockErrorResponse());
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
			});
		});
	});
});
