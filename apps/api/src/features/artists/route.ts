import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import { getDb } from "../../shared/db";
import {
	toArtist,
	toArtistCreateDbModel,
	toArtistUpdateDbModel,
	validateArtistCreateInput,
	validateArtistUpdateInput,
} from "./model";
import {
	createArtist,
	findArtistById,
	listArtists,
	softDeleteArtistById,
	updateArtistById,
} from "./repository";

const artistBodySchema = type({
	name: type.pipe(type("string.trim"), type("string >= 1"), type("string <= 255")),
	"ipiCode?": type.pipe(type("string.trim"), type("string <= 20")),
	"type?": "'person' | 'group'",
	"gender?": type.pipe(type("string.trim"), type("string <= 20")),
	"birthplace?": type.pipe(type("string.trim"), type("string <= 100")),
	"birthdate?": "string",
});

const artistBodyValidator = arktypeValidator("json", artistBodySchema, (result, c) => {
	if (!result.success) {
		return c.json({ message: "Please provide a valid artist payload." }, 400);
	}
});

const artistIdParamSchema = type({
	id: "string.uuid",
});

const artistIdParamValidator = arktypeValidator("param", artistIdParamSchema, (result, c) => {
	if (!result.success) {
		return c.json({ message: "Please provide a valid artist id." }, 400);
	}
});

const artistUpdateBodySchema = type({
	"name?": type.pipe(type("string.trim"), type("string >= 1"), type("string <= 255")),
	"ipiCode?": type.pipe(type("string.trim"), type("string <= 20")),
	"type?": "'person' | 'group'",
	"gender?": type.pipe(type("string.trim"), type("string <= 20")),
	"birthplace?": type.pipe(type("string.trim"), type("string <= 100")),
	"birthdate?": "string",
});

const artistUpdateBodyValidator = arktypeValidator("json", artistUpdateBodySchema, (result, c) => {
	if (!result.success) {
		return c.json({ message: "Please provide a valid artist payload." }, 400);
	}
});

const artists = new Hono()
	.get("/api/artists", async (c) => {
		const db = getDb(c);
		const rows = await db.transaction((tx) => listArtists(tx)).catch(() => null);
		if (rows === null) {
			return c.json({ message: "Failed to fetch artists." }, 500);
		}
		return c.json({ artists: rows.map(toArtist) });
	})
	.get("/api/artists/:id", artistIdParamValidator, async (c) => {
		const db = getDb(c);
		const { id } = c.req.valid("param");

		const artist = await db
			.transaction((tx) => findArtistById(tx, id))
			.catch(() => new Error("failed"));
		if (artist instanceof Error) {
			return c.json({ message: "Failed to fetch artist." }, 500);
		}
		if (artist === null) {
			return c.json({ message: "Artist not found." }, 404);
		}

		return c.json({ artist: toArtist(artist) });
	})
	.post("/api/artists", artistBodyValidator, async (c) => {
		const db = getDb(c);
		const payload = c.req.valid("json");
		const validPayload = validateArtistCreateInput(payload);
		if (validPayload instanceof Error) {
			return c.json({ message: validPayload.message }, 400);
		}

		const rows = await db
			.transaction((tx) => createArtist(tx, toArtistCreateDbModel(validPayload)))
			.catch(() => null);

		if (rows === null) {
			return c.json({ message: "Failed to create artist." }, 500);
		}

		const [artist] = rows;
		if (!artist) {
			return c.json({ message: "Failed to create artist." }, 500);
		}

		return c.json({ artist: toArtist(artist) }, 201);
	})
	.patch("/api/artists/:id", artistIdParamValidator, artistUpdateBodyValidator, async (c) => {
		const db = getDb(c);
		const { id } = c.req.valid("param");
		const payload = c.req.valid("json");
		const validPayload = validateArtistUpdateInput(payload);
		if (validPayload instanceof Error) {
			return c.json({ message: validPayload.message }, 400);
		}

		const updatedArtist = await db
			.transaction((tx) =>
				updateArtistById(tx, { id, values: toArtistUpdateDbModel(validPayload) }),
			)
			.catch(() => new Error("failed"));
		if (updatedArtist instanceof Error) {
			return c.json({ message: "Failed to update artist." }, 500);
		}
		if (updatedArtist === null) {
			return c.json({ message: "Artist not found." }, 404);
		}

		return c.json({ artist: toArtist(updatedArtist) });
	})
	.delete("/api/artists/:id", artistIdParamValidator, async (c) => {
		const db = getDb(c);
		const { id } = c.req.valid("param");

		const deletedArtist = await db
			.transaction((tx) => softDeleteArtistById(tx, id))
			.catch(() => new Error("failed"));
		if (deletedArtist instanceof Error) {
			return c.json({ message: "Failed to delete artist." }, 500);
		}
		if (deletedArtist === null) {
			return c.json({ message: "Artist not found." }, 404);
		}

		return c.body(null, 204);
	});

export { artists };
