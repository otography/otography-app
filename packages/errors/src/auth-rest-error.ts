import type { ContentfulStatusCode } from "hono/utils/http-status";
import * as errore from "errore";

class AuthRestError extends errore.createTaggedError({
	name: "AuthRestError",
	message: "$message",
}) {
	readonly statusCode: ContentfulStatusCode;

	constructor(args: { message: string; statusCode: ContentfulStatusCode; cause?: unknown }) {
		super(args);
		this.statusCode = args.statusCode;
	}
}

export { AuthRestError };
