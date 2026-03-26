import { describe, expect, it } from "vitest";
import { testRequest } from "./helpers/test-client";

describe("GET /", () => {
	it("returns 200 with Hello Hono!", async () => {
		const res = await testRequest("/");

		expect(res.status).toBe(200);
		expect(await res.text()).toBe("Hello Hono!");
	});
});
