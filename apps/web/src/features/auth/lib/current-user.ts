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
  console.info("getCurrentUser started.");
  const api = await getServerApi();

  const response = await api.user
    .$get()
    .catch((e: unknown) => new FetchCurrentUserError({ cause: e }));
  if (response instanceof Error) {
    console.error("getCurrentUser request failed.", response);
    return response;
  }

  console.info("getCurrentUser received response.", {
    status: response.status,
    ok: response.ok,
  });

  if (response.status === 401) {
    console.info("getCurrentUser mapped response to UnauthenticatedError.");
    return new UnauthenticatedError();
  }
  if (response.status === 404) {
    console.info("getCurrentUser mapped response to NoProfileError.");
    return new NoProfileError();
  }
  if (!response.ok) {
    console.error("getCurrentUser received unexpected status.", { status: response.status });
    return new UnexpectedStatusError({ status: response.status });
  }

  const body = await response.json().catch((e: unknown) => new JsonParseError({ cause: e }));
  if (body instanceof Error) {
    console.error("getCurrentUser failed to parse JSON.", body);
    return body;
  }

  console.info("getCurrentUser succeeded.");
  return body;
});
