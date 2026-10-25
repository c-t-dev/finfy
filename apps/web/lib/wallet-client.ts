import { toWalletResponse, type WalletClient } from "@packages/app/wallets";

async function send<T>(method: string, path: string, body: unknown) {
  const response = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  return toWalletResponse<T>(response.status, await response.json().catch(() => null));
}

/** Web transport for wallet writes: same-origin JSON; the session travels in an HttpOnly cookie. */
export const webWalletClient: WalletClient = {
  create: (input) => send("POST", "/api/wallets", input),
  update: (walletId, input) => send("PATCH", `/api/wallets/${walletId}`, input),
  archive: (walletId, input) => send("POST", `/api/wallets/${walletId}/archive`, input),
};
