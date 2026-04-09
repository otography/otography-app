import { type } from "arktype";
import { cookies } from "next/headers";
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
  });

  if (response.status === 401 || response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error("Failed to fetch the current user.");
  }

  const currentUser = currentUserResponseSchema(await response.json());

  if (currentUser instanceof type.errors) {
    throw new Error("Failed to parse the current user response.");
  }

  return currentUser;
};
