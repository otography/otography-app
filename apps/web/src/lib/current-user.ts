import { type } from "arktype";
import { cookies } from "next/headers";
import { env } from "@/env";

const currentUserResponseSchema = type({
  message: "string",
  profile: {
    createdAt: "string",
    displayName: "string | null",
    email: "string | null",
    id: "string",
    photoUrl: "string | null",
    updatedAt: "string",
  },
  userId: "string",
});

export const getCurrentUser = async () => {
  const cookieStore = await cookies();
  const response = await fetch(new URL("/api/user", env.NEXT_PUBLIC_API_URL), {
    headers: {
      cookie: cookieStore.toString(),
    },
    cache: "no-store",
  });

  if (response.status === 401) {
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
