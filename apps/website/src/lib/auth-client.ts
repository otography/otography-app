import type { Auth } from "api";
import { inferAdditionalFields } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

// SPA と API は同じオリジンで配信するので、baseURL は指定しない（/api/auth/* に送られる）。
export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<Auth>()],
});
