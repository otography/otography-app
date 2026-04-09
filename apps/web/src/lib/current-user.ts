import {
  NoProfileError,
  UnauthenticatedError,
  FetchCurrentUserError,
  UnexpectedStatusError,
  JsonParseError,
} from "@repo/errors";
import { getServerApi } from "@/lib/server-api";

export const getCurrentUser = async () => {
  const api = await getServerApi();

  const response = await api.user.$get().catch((e) => new FetchCurrentUserError({ cause: e }));
  if (response instanceof Error) return response;

  if (response.status === 401) return new UnauthenticatedError();
  if (response.status === 404) return new NoProfileError();
  if (!response.ok) return new UnexpectedStatusError({ status: response.status });

  const body = await response.json().catch((e) => new JsonParseError({ cause: e }));
  if (body instanceof Error) return body;

  return body;
};
