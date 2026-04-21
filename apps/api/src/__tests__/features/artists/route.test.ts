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

describe("artists endpoints", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("GET /api/artists returns artists list", async () => {
		mockDbWithTransaction({
			select: vi.fn(() => ({
				from: vi.fn(() => ({
					where: vi.fn(() => ({
						orderBy: vi.fn().mockResolvedValue([
							{
								id: "8f648f36-5be1-4af1-bf5d-cf8ebf211111",
								name: "Sample Artist",
								ipiCode: null,
								type: "person",
								gender: null,
								birthplace: null,
								birthdate: null,
								createdAt: "2026-01-01T00:00:00.000Z",
								updatedAt: "2026-01-01T00:00:00.000Z",
							},
						]),
					})),
				})),
			})),
		});

		const res = await testRequest("/api/artists");

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			artists: [
				{
					id: "8f648f36-5be1-4af1-bf5d-cf8ebf211111",
					name: "Sample Artist",
					ipiCode: null,
					type: "person",
					gender: null,
					birthplace: null,
					birthdate: null,
					createdAt: "2026-01-01T00:00:00.000Z",
					updatedAt: "2026-01-01T00:00:00.000Z",
				},
			],
		});
	});

	it("POST /api/artists creates artist", async () => {
		mockDbWithTransaction({
			insert: vi.fn(() => ({
				values: vi.fn(() => ({
					returning: vi.fn().mockResolvedValue([
						{
							id: "8f648f36-5be1-4af1-bf5d-cf8ebf211112",
							name: "New Artist",
							ipiCode: null,
							type: "group",
							gender: null,
							birthplace: null,
							birthdate: null,
							createdAt: "2026-01-01T00:00:00.000Z",
							updatedAt: "2026-01-01T00:00:00.000Z",
						},
					]),
				})),
			})),
		});

		const res = await testRequest("/api/artists", {
			method: "POST",
			body: {
				name: "New Artist",
				type: "group",
			},
		});

		expect(res.status).toBe(201);
		expect(await res.json()).toEqual({
			artist: {
				id: "8f648f36-5be1-4af1-bf5d-cf8ebf211112",
				name: "New Artist",
				ipiCode: null,
				type: "group",
				gender: null,
				birthplace: null,
				birthdate: null,
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-01T00:00:00.000Z",
			},
		});
	});

	it("POST /api/artists returns 400 for invalid payload", async () => {
		const res = await testRequest("/api/artists", {
			method: "POST",
			body: {
				name: "",
				type: "band",
			},
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ message: "Please provide a valid artist payload." });
	});

	it("POST /api/artists returns 400 for invalid birthplace", async () => {
		const res = await testRequest("/api/artists", {
			method: "POST",
			body: {
				name: "Bad Birthplace Artist",
				birthplace: "New York",
			},
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ message: "Please provide a valid artist birthplace." });
	});

	it("POST /api/artists returns 400 for invalid birthdate", async () => {
		const res = await testRequest("/api/artists", {
			method: "POST",
			body: {
				name: "Bad Birthdate Artist",
				birthdate: "2026-02-30",
			},
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ message: "Please provide a valid artist birthdate." });
	});

	it("PATCH /api/artists/:id updates artist", async () => {
		mockDbWithTransaction({
			update: vi.fn(() => ({
				set: vi.fn(() => ({
					where: vi.fn(() => ({
						returning: vi.fn().mockResolvedValue([
							{
								id: "8f648f36-5be1-4af1-bf5d-cf8ebf211113",
								name: "Updated Artist",
								ipiCode: null,
								type: "person",
								gender: null,
								birthplace: "Tokyo",
								birthdate: "2000-01-01",
								createdAt: "2026-01-01T00:00:00.000Z",
								updatedAt: "2026-01-02T00:00:00.000Z",
							},
						]),
					})),
				})),
			})),
		});

		const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211113", {
			method: "PATCH",
			body: {
				name: "Updated Artist",
				birthplace: "Tokyo",
				birthdate: "2000-01-01",
			},
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({
			artist: {
				id: "8f648f36-5be1-4af1-bf5d-cf8ebf211113",
				name: "Updated Artist",
				ipiCode: null,
				type: "person",
				gender: null,
				birthplace: "Tokyo",
				birthdate: "2000-01-01",
				createdAt: "2026-01-01T00:00:00.000Z",
				updatedAt: "2026-01-02T00:00:00.000Z",
			},
		});
	});

	it("PATCH /api/artists/:id returns 400 for empty payload", async () => {
		const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211113", {
			method: "PATCH",
			body: {},
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({ message: "Please provide at least one field to update." });
	});

	it("DELETE /api/artists/:id soft deletes artist", async () => {
		mockDbWithTransaction({
			update: vi.fn(() => ({
				set: vi.fn(() => ({
					where: vi.fn(() => ({
						returning: vi.fn().mockResolvedValue([
							{
								id: "8f648f36-5be1-4af1-bf5d-cf8ebf211114",
							},
						]),
					})),
				})),
			})),
		});

		const res = await testRequest("/api/artists/8f648f36-5be1-4af1-bf5d-cf8ebf211114", {
			method: "DELETE",
		});

		expect(res.status).toBe(204);
	});
});
