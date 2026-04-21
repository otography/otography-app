import { type } from "arktype";
import { arktypeValidator } from "@hono/arktype-validator";
import { Hono } from "hono";
import { getDb } from "../../shared/db";
import { createSong, findSongById, listSongs } from "./repository";

const songBodySchema = type({
	title: type.pipe(type("string.trim"), type("string >= 1"), type("string <= 255")),
	"length?": "number.integer >= 0",
	"isrcs?": type.pipe(type("string.trim"), type("string <= 50")),
});

const songBodyValidator = arktypeValidator("json", songBodySchema, (result, c) => {
	if (!result.success) {
		return c.json({ message: "Please provide a valid song payload." }, 400);
	}
});

const songIdParamSchema = type({
	id: "string.uuid",
});

const songIdParamValidator = arktypeValidator("param", songIdParamSchema, (result, c) => {
	if (!result.success) {
		return c.json({ message: "Please provide a valid song id." }, 400);
	}
});

const songs = new Hono()
	.get("/api/songs", async (c) => {
		const db = getDb(c);
		const rows = await db.transaction((tx) => listSongs(tx)).catch(() => null);
		if (rows === null) {
			return c.json({ message: "Failed to fetch songs." }, 500);
		}
		return c.json({ songs: rows });
	})
	.get("/api/songs/:id", songIdParamValidator, async (c) => {
		const db = getDb(c);
		const { id } = c.req.valid("param");

		const song = await db
			.transaction((tx) => findSongById(tx, id))
			.catch(() => new Error("failed"));
		if (song instanceof Error) {
			return c.json({ message: "Failed to fetch song." }, 500);
		}
		if (song === null) {
			return c.json({ message: "Song not found." }, 404);
		}

		return c.json({ song });
	})
	.post("/api/songs", songBodyValidator, async (c) => {
		const db = getDb(c);
		const payload = c.req.valid("json");
		const rows = await db.transaction((tx) => createSong(tx, payload)).catch(() => null);

		if (rows === null) {
			return c.json({ message: "Failed to create song." }, 500);
		}

		const [song] = rows;
		if (!song) {
			return c.json({ message: "Failed to create song." }, 500);
		}

		return c.json({ song }, 201);
	});

export { songs };
