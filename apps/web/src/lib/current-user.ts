import { type } from "arktype";
import { cookies } from "next/headers";
import {
  NoProfileError,
  UnauthenticatedError,
  FetchCurrentUserError,
  UnexpectedStatusError,
  JsonParseError,
  SchemaValidationError,
} from "@repo/errors";
import { env } from "@/env";

const currentUserResponseSchema = type({
  message: "string",
  profile: {
    createdAt: "string",
    email: "string | null",
    name: "string | null",
    photoUrl: "string | null",
    updatedAt: "string",
    username: "string",
    bio: "string | null",
    birthplace: "string | null",
    birthyear: "number | null",
    gender: "string | null",
  },
});

export const getCurrentUser = async () => {
  const cookieStore = await cookies();
  const response = await fetch(new URL("/api/user", env.NEXT_PUBLIC_API_URL), {
    headers: {
      cookie: cookieStore.toString(),
    },
    cache: "no-store",
  }).catch((e) => new FetchCurrentUserError({ cause: e }));
  if (response instanceof Error) return response;

  if (response.status === 401) return new UnauthenticatedError();
  if (response.status === 404) return new NoProfileError();
  if (!response.ok) return new UnexpectedStatusError({ status: response.status });

  const body = await (response.json() as Promise<unknown>).catch(
    (e) => new JsonParseError({ cause: e }),
  );
  if (body instanceof Error) return body;

  const currentUser = currentUserResponseSchema(body);
  if (currentUser instanceof type.errors) {
    return new SchemaValidationError({ summary: currentUser.summary });
  }

  return currentUser;
};
