import { cache } from "react";
import {
  NoProfileError,
  UnauthenticatedError,
  FetchCurrentUserError,
  UnexpectedStatusError,
  JsonParseError,
} from "@repo/errors";
import { getServerApi } from "@/features/lib/server-api";

export const getCurrentUser = cache(async () => {
  const api = await getServerApi();

  const response = await api.user
    .$get()
    .catch((e: unknown) => new FetchCurrentUserError({ cause: e }));
  if (response instanceof Error) return response;

  if (response.status === 401) return new UnauthenticatedError();
  if (response.status === 404) return new NoProfileError();
  if (!response.ok) return new UnexpectedStatusError({ status: response.status });

  const body = await response.json().catch((e: unknown) => new JsonParseError({ cause: e }));
  if (body instanceof Error) return body;

  return body;
});
