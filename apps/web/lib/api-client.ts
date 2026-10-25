import type { ApiRequest } from "@packages/app/api";
import { toWalletResponse } from "@packages/app/wallets";

/** Web transport for the finfy API: same-origin JSON; the session travels in an HttpOnly cookie. */
export const webApiRequest: ApiRequest = async (method, path, body) => {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  return toWalletResponse(response.status, await response.json().catch(() => null));
};
