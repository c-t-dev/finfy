"use client";

import * as React from "react";
import type {
  Account,
  AccountStateInput,
  CreateAccountInput,
  UpdateAccountInput,
} from "@packages/shared/accounts";
import type { WalletResponse } from "./wallets";

/**
 * Accounts on the client. The host passes the transport; screens load the
 * current wallet's accounts through `useAccounts`.
 */
export interface AccountClient {
  list(walletId: string, archived: boolean): Promise<WalletResponse<Account[]>>;
  create(walletId: string, input: CreateAccountInput): Promise<WalletResponse<Account>>;
  update(walletId: string, accountId: string, input: UpdateAccountInput): Promise<WalletResponse<Account>>;
  archive(walletId: string, accountId: string, input: AccountStateInput): Promise<WalletResponse<Account>>;
  restore(walletId: string, accountId: string, input: AccountStateInput): Promise<WalletResponse<Account>>;
}

const AccountClientContext = React.createContext<AccountClient | null>(null);

export function AccountClientProvider({ client, children }: { client: AccountClient; children: React.ReactNode }) {
  return <AccountClientContext.Provider value={client}>{children}</AccountClientContext.Provider>;
}

export function useAccountClient(): AccountClient {
  const client = React.useContext(AccountClientContext);
  if (!client) throw new Error("useAccountClient must be used inside AccountClientProvider");
  return client;
}

type ListState = { status: "loading" } | { status: "ready"; accounts: Account[] } | { status: "error" };

/**
 * One list (active or archived) of a wallet's accounts, reloaded when the
 * wallet changes. `apply` puts a server answer in place after a write.
 */
export function useAccountList(walletId: string | null, archived: boolean, enabled = true) {
  const client = useAccountClient();
  const [state, setState] = React.useState<ListState>({ status: "loading" });
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!walletId || !enabled) return;
    let active = true;
    setState({ status: "loading" });
    client.list(walletId, archived).then(
      (response) => active && setState(response.ok ? { status: "ready", accounts: response.value } : { status: "error" }),
      () => active && setState({ status: "error" }),
    );
    return () => {
      active = false;
    };
  }, [client, walletId, archived, enabled, reloadKey]);

  const reload = React.useCallback(() => setReloadKey((key) => key + 1), []);
  return { state, reload };
}
