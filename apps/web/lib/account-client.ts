import type { Account } from "@packages/shared/accounts";
import type { AccountClient } from "@packages/app/accounts";
import { toWalletResponse } from "@packages/app/wallets";

async function send<T>(method: string, path: string, body?: unknown) {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: "same-origin",
  });
  return toWalletResponse<T>(response.status, await response.json().catch(() => null));
}

const base = (walletId: string) => `/api/wallets/${walletId}/accounts`;

/** Web transport for accounts: same-origin JSON; the session travels in an HttpOnly cookie. */
export const webAccountClient: AccountClient = {
  async list(walletId, archived) {
    const response = await send<{ accounts: Account[] }>("GET", `${base(walletId)}${archived ? "?archived=1" : ""}`);
    return response.ok ? { ok: true, value: response.value.accounts } : response;
  },
  create: (walletId, input) => send("POST", base(walletId), input),
  update: (walletId, accountId, input) => send("PATCH", `${base(walletId)}/${accountId}`, input),
  archive: (walletId, accountId, input) => send("POST", `${base(walletId)}/${accountId}/archive`, input),
  restore: (walletId, accountId, input) => send("POST", `${base(walletId)}/${accountId}/restore`, input),
};
