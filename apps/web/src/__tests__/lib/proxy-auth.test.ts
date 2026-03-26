// @vitest-environment node

import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { guardAuthenticatedRoutes } from "../../lib/proxy-auth";

function createRequest(path: string, cookieHeader?: string): NextRequest {
	const headers = new Headers();
	if (cookieHeader !== undefined) {
		headers.set("Cookie", cookieHeader);
	}
	return new NextRequest(new URL(path, "http://localhost:3000"), { headers });
}

describe("guardAuthenticatedRoutes", () => {
	describe("public paths", () => {
		it("returns NextResponse.next() for /login", () => {
			const request = createRequest("/login");
			const result = guardAuthenticatedRoutes(request);

			expect(result.status).toBe(200);
		});

		it("returns NextResponse.next() for /login with query params", () => {
			const request = createRequest("/login?error=credentials");
			const result = guardAuthenticatedRoutes(request);

			expect(result.status).toBe(200);
		});

		it("returns NextResponse.next() for paths starting with /login", () => {
			const request = createRequest("/login/oauth/callback");
			const result = guardAuthenticatedRoutes(request);

			expect(result.status).toBe(200);
		});
	});

	describe("authenticated requests (with session cookie)", () => {
		it("returns NextResponse.next() for /account with session cookie", () => {
			const request = createRequest("/account", "otography_session=valid-session");
			const result = guardAuthenticatedRoutes(request);

			expect(result.status).toBe(200);
		});

		it("returns NextResponse.next() for / with session cookie", () => {
			const request = createRequest("/", "otography_session=valid-session");
			const result = guardAuthenticatedRoutes(request);

			expect(result.status).toBe(200);
		});

		it("returns NextResponse.next() for any path with session cookie", () => {
			const request = createRequest("/some/deep/path", "otography_session=valid-session");
			const result = guardAuthenticatedRoutes(request);

			expect(result.status).toBe(200);
		});
	});

	describe("unauthenticated requests (no session cookie)", () => {
		it("redirects to /login for /account without cookie", () => {
			const request = createRequest("/account");
			const result = guardAuthenticatedRoutes(request);

			expect(result.status).toBe(307);
			expect(result.headers.get("Location")).toBe("http://localhost:3000/login");
		});

		it("redirects to /login for / without cookie", () => {
			const request = createRequest("/");
			const result = guardAuthenticatedRoutes(request);

			expect(result.status).toBe(307);
			expect(result.headers.get("Location")).toBe("http://localhost:3000/login");
		});

		it("redirects to /login for any path without cookie", () => {
			const request = createRequest("/settings/profile");
			const result = guardAuthenticatedRoutes(request);

			expect(result.status).toBe(307);
			expect(result.headers.get("Location")).toBe("http://localhost:3000/login");
		});

		it("redirects when cookie is present but value is empty", () => {
			const request = createRequest("/account", "otography_session=");
			const result = guardAuthenticatedRoutes(request);

			expect(result.status).toBe(307);
			expect(result.headers.get("Location")).toBe("http://localhost:3000/login");
		});
	});
});
