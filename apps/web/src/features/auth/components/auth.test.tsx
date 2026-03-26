import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

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

const mockSignInPost = vi.hoisted(() => vi.fn());
const mockSignUpPost = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
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

import { AuthForm } from "./auth-form";

function mockOkResponse() {
	return { ok: true as const, json: () => Promise.resolve({ message: "ok" }) };
}

function mockErrorResponse(message?: string) {
	return { ok: false as const, json: () => Promise.resolve(message ? { message } : null) };
}

describe("AuthForm", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mockUseSearchParams.mockReturnValue(new URLSearchParams());
	});

	describe("OAuth links", () => {
		it("renders Google OAuth link pointing to API endpoint", () => {
			render(<AuthForm />);
			expect(screen.getByText("Continue with Google")).toHaveAttribute(
				"href",
				"http://localhost:3001/api/auth/oauth/google/start",
			);
		});

		it("renders Apple OAuth link pointing to API endpoint", () => {
			render(<AuthForm />);
			expect(screen.getByText("Continue with Apple")).toHaveAttribute(
				"href",
				"http://localhost:3001/api/auth/oauth/apple/start",
			);
		});
	});

	describe("error from searchParams", () => {
		it("displays error message from URL query parameter", () => {
			mockUseSearchParams.mockReturnValue(new URLSearchParams("error=OAuth+failed"));
			render(<AuthForm />);
			expect(screen.getByText("OAuth failed")).toBeInTheDocument();
		});
	});

	describe("sign-in", () => {
		it("completes sign-in without showing errors on success", async () => {
			mockSignInPost.mockResolvedValue(mockOkResponse());
			const user = userEvent.setup();

			render(<AuthForm />);
			await user.type(screen.getByLabelText("Email"), "test@example.com");
			await user.type(screen.getByLabelText("Password"), "password123");
			await user.click(screen.getByRole("button", { name: "Sign in" }));

			await waitFor(() => {
				expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
			});
			expect(screen.queryByText("Authentication failed.")).not.toBeInTheDocument();
		});

		it("shows pending state and disables all actions while signing in", async () => {
			let resolveResponse!: (value: unknown) => void;
			mockSignInPost.mockReturnValue(
				new Promise((resolve) => {
					resolveResponse = resolve;
				}),
			);
			const user = userEvent.setup();

			render(<AuthForm />);
			await user.type(screen.getByLabelText("Email"), "test@example.com");
			await user.type(screen.getByLabelText("Password"), "password123");
			await user.click(screen.getByRole("button", { name: "Sign in" }));

			expect(screen.getByRole("button", { name: "Signing in..." })).toBeDisabled();
			expect(screen.getByRole("button", { name: "Create account" })).toBeDisabled();
			expect(screen.getByText("Continue with Google")).toHaveStyle({
				opacity: "0.6",
				pointerEvents: "none",
			});

			resolveResponse(mockOkResponse());
			await waitFor(() => {
				expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
			});
		});

		it("shows server error message on auth failure", async () => {
			mockSignInPost.mockResolvedValue(mockErrorResponse("Invalid email or password."));
			const user = userEvent.setup();

			render(<AuthForm />);
			await user.type(screen.getByLabelText("Email"), "test@example.com");
			await user.type(screen.getByLabelText("Password"), "password123");
			await user.click(screen.getByRole("button", { name: "Sign in" }));

			await waitFor(() => {
				expect(screen.getByText("Invalid email or password.")).toBeInTheDocument();
			});
		});

		it("shows fallback error when server returns no usable message", async () => {
			mockSignInPost.mockResolvedValue({ ok: false as const, json: () => Promise.resolve(null) });
			const user = userEvent.setup();

			render(<AuthForm />);
			await user.type(screen.getByLabelText("Email"), "test@example.com");
			await user.type(screen.getByLabelText("Password"), "password123");
			await user.click(screen.getByRole("button", { name: "Sign in" }));

			await waitFor(() => {
				expect(screen.getByText("Authentication failed.")).toBeInTheDocument();
			});
		});

		it("shows network error message when API is unreachable", async () => {
			mockSignInPost.mockRejectedValue(new Error("Network error"));
			const user = userEvent.setup();

			render(<AuthForm />);
			await user.type(screen.getByLabelText("Email"), "test@example.com");
			await user.type(screen.getByLabelText("Password"), "password123");
			await user.click(screen.getByRole("button", { name: "Sign in" }));

			await waitFor(() => {
				expect(screen.getByText("Unable to reach the authentication API.")).toBeInTheDocument();
			});
		});
	});

	describe("sign-up", () => {
		it("completes sign-up without showing errors on success", async () => {
			mockSignUpPost.mockResolvedValue(mockOkResponse());
			const user = userEvent.setup();

			render(<AuthForm />);
			await user.type(screen.getByLabelText("Email"), "test@example.com");
			await user.type(screen.getByLabelText("Password"), "password123");
			await user.click(screen.getByRole("button", { name: "Create account" }));

			await waitFor(() => {
				expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
			});
			expect(screen.queryByText("Authentication failed.")).not.toBeInTheDocument();
		});

		it("shows pending state while creating account", async () => {
			let resolveResponse!: (value: unknown) => void;
			mockSignUpPost.mockReturnValue(
				new Promise((resolve) => {
					resolveResponse = resolve;
				}),
			);
			const user = userEvent.setup();

			render(<AuthForm />);
			await user.type(screen.getByLabelText("Email"), "test@example.com");
			await user.type(screen.getByLabelText("Password"), "password123");
			await user.click(screen.getByRole("button", { name: "Create account" }));

			expect(screen.getByRole("button", { name: "Creating..." })).toBeInTheDocument();

			resolveResponse(mockOkResponse());
			await waitFor(() => {
				expect(screen.getByRole("button", { name: "Create account" })).toBeEnabled();
			});
		});

		it("shows server error on sign-up failure", async () => {
			mockSignUpPost.mockResolvedValue(mockErrorResponse("Email already exists."));
			const user = userEvent.setup();

			render(<AuthForm />);
			await user.type(screen.getByLabelText("Email"), "test@example.com");
			await user.type(screen.getByLabelText("Password"), "password123");
			await user.click(screen.getByRole("button", { name: "Create account" }));

			await waitFor(() => {
				expect(screen.getByText("Email already exists.")).toBeInTheDocument();
			});
		});
	});
});
