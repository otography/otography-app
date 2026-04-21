import { describe, expect, it, vi } from "vitest";
import { testRequest } from "../../helpers/test-client";

vi.mock("../../../shared/firebase-rest", () => ({
	signInWithPassword: vi.fn(),
	signUpWithPassword: vi.fn(),
}));

vi.mock("../../../shared/db", () => ({
	getDb: vi.fn(),
}));

import { getDb } from "../../../shared/db";

const mockDbWithTransaction = (txMethods: Record<string, unknown>) => {
	vi.mocked(getDb).mockReturnValue({
		transaction: vi.fn(async (fn) => fn(txMethods)),
	} as never);
};

describe("songs endpoints", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("GET /api/songs returns songs list", async () => {
		mockDbWithTransaction({
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn().mockResolvedValue([
							{
								id: "8f648f36-5be1-4af1-bf5d-cf8ebf222221",
								title: "Sample Song",
								length: 180,
							},
						]),
					})),
				})),
			})),
		});

		const res = await testRequest("/api/songs");

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			songs: [
				{
					id: "8f648f36-5be1-4af1-bf5d-cf8ebf222221",
					title: "Sample Song",
					length: 180,
				},
			],
		});
	});

	it("POST /api/songs creates song", async () => {
		mockDbWithTransaction({
			insert: vi.fn(() => ({
				values: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([
						{
							id: "8f648f36-5be1-4af1-bf5d-cf8ebf222222",
							title: "New Song",
							length: 240,
						},
					]),
				})),
			})),
		});

		const res = await testRequest("/api/songs", {
			method: "POST",
			body: {
				title: "New Song",
				length: 240,
			},
		});

		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({
			song: {
				id: "8f648f36-5be1-4af1-bf5d-cf8ebf222222",
				title: "New Song",
				length: 240,
			},
		});
	});

	it("POST /api/songs returns 400 for invalid payload", async () => {
		const res = await testRequest("/api/songs", {
			method: "POST",
			body: {
				title: "",
				length: -1,
			},
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ message: "Please provide a valid song payload." });
	});
});
