import { createInsertSchema } from "drizzle-orm/arktype";
import { sql } from "drizzle-orm";
import { pgPolicy, pgRole, pgTable, text, timestamp } from "drizzle-orm/pg-core";

const authenticatedRole = pgRole("authenticated");

export const profiles = pgTable(
	"profiles",
	{
		id: text("id").primaryKey(),
		email: text("email"),
		displayName: text("display_name"),
		photoUrl: text("photo_url"),
		createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
		updatedAt: timestamp("updated_at", { withTimezone: true })
			.notNull()
			.defaultNow()
			.$onUpdate(() => new Date()),
	},
	(table) => [
		pgPolicy("profiles_select_own", {
			for: "select",
			to: authenticatedRole,
			using: sql`${table.id} = requesting_user_id()`,
		}),
		pgPolicy("profiles_insert_own", {
			for: "insert",
			to: authenticatedRole,
			withCheck: sql`${table.id} = requesting_user_id()`,
		}),
		pgPolicy("profiles_update_own", {
			for: "update",
			to: authenticatedRole,
			using: sql`${table.id} = requesting_user_id()`,
			withCheck: sql`${table.id} = requesting_user_id()`,
		}),
	],
);

export const profileInsertSchema = createInsertSchema(profiles);
