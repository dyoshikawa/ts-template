import { passkeyClient } from "@better-auth/passkey/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

import { fetchOrUnreachable } from "./unreachable";

export const authClient = createAuthClient({
  // A request that cannot reach the server comes back as an error with the
  // UNREACHABLE code, like any refusal, instead of a thrown one that would
  // leave the waiting button spinning.
  fetchOptions: { customFetchImpl: fetchOrUnreachable },
  plugins: [emailOTPClient(), passkeyClient()],
});
