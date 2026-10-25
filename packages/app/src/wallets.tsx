"use client";

import * as React from "react";
import { newId } from "@packages/shared/ids";
import type { CurrencyCode } from "@packages/shared/money";
import {
  WALLET_ERRORS,
  type ArchiveWalletInput,
  type CreateWalletInput,
  type UpdateWalletInput,
  type Wallet,
  type WalletError,
} from "@packages/shared/wallets";

/**
 * Wallets on the client. The host passes a transport (`WalletClient`), the
 * wallets it loaded and the current one; this keeps the list in memory and
 * builds each write the way the sync rules want: the client makes the IDs and
 * the `mutationId`, and sends the version it was editing.
 */

export type WalletFailure = { error: WalletError; retryAfterSeconds?: number };
export type WalletResponse<T> = { ok: true; value: T } | ({ ok: false } & WalletFailure);

export interface WalletClient {
  create(input: CreateWalletInput): Promise<WalletResponse<Wallet>>;
  update(walletId: string, input: UpdateWalletInput): Promise<WalletResponse<Wallet>>;
  archive(walletId: string, input: ArchiveWalletInput): Promise<WalletResponse<null>>;
}

/** Turns a response status and body into a WalletResponse; unknown errors become `unavailable`. */
export function toWalletResponse<T>(status: number, body: unknown): WalletResponse<T> {
  if (status >= 200 && status < 300) return { ok: true, value: (status === 204 ? null : body) as T };
  const error = (body as { error?: string } | null)?.error;
  const retryAfterSeconds = (body as { retryAfterSeconds?: number } | null)?.retryAfterSeconds;
  return {
    ok: false,
    error: WALLET_ERRORS.includes(error as WalletError) ? (error as WalletError) : "unavailable",
    retryAfterSeconds,
  };
}

interface WalletsValue {
  wallets: Wallet[];
  current: Wallet | null;
  select(walletId: string): void;
  create(name: string, currencyCode: CurrencyCode): Promise<WalletResponse<Wallet>>;
  update(patch: { name?: string; currencyCode?: CurrencyCode }): Promise<WalletResponse<Wallet>>;
  archive(password: string): Promise<WalletResponse<null>>;
}

const WalletsContext = React.createContext<WalletsValue | null>(null);

export function WalletProvider({
  client,
  initialWallets,
  initialCurrentId,
  onCurrentChange,
  children,
}: {
  client: WalletClient;
  initialWallets: Wallet[];
  initialCurrentId: string | null;
  /** Where the host remembers the current wallet (a cookie on the web). */
  onCurrentChange: (walletId: string | null) => void;
  children: React.ReactNode;
}) {
  const [wallets, setWallets] = React.useState(initialWallets);
  const [currentId, setCurrentId] = React.useState(initialCurrentId);
  const current = wallets.find((wallet) => wallet.id === currentId) ?? wallets[0] ?? null;

  const value = React.useMemo<WalletsValue>(() => {
    const select = (walletId: string | null) => {
      setCurrentId(walletId);
      onCurrentChange(walletId);
    };
    const replace = (wallet: Wallet) => setWallets((list) => list.map((w) => (w.id === wallet.id ? wallet : w)));

    return {
      wallets,
      current,
      select,
      async create(name, currencyCode) {
        const response = await client.create({ id: newId(), mutationId: newId(), name, currencyCode });
        if (response.ok) {
          setWallets((list) => [...list.filter((w) => w.id !== response.value.id), response.value]);
          select(response.value.id);
        }
        return response;
      },
      async update(patch) {
        if (!current) return { ok: false, error: "notFound" };
        const response = await client.update(current.id, { mutationId: newId(), baseVersion: current.version, ...patch });
        if (response.ok) replace(response.value);
        return response;
      },
      async archive(password) {
        if (!current) return { ok: false, error: "notFound" };
        const response = await client.archive(current.id, { mutationId: newId(), baseVersion: current.version, password });
        if (response.ok) {
          const rest = wallets.filter((w) => w.id !== current.id);
          setWallets(rest);
          select(rest[0]?.id ?? null);
        }
        return response;
      },
    };
  }, [client, current, onCurrentChange, wallets]);

  return <WalletsContext.Provider value={value}>{children}</WalletsContext.Provider>;
}

export function useWallets(): WalletsValue {
  const value = React.useContext(WalletsContext);
  if (!value) throw new Error("useWallets must be used inside WalletProvider");
  return value;
}
