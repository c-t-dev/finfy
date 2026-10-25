"use client";

import * as React from "react";
import type { WalletResponse } from "./wallets";

/**
 * One transport for every resource: the host passes how to call the finfy
 * HTTP API (same-origin fetch on the web; the Tauri and Capacitor builds will
 * pass their own). Screens build paths like `/api/wallets/:id/categories`.
 */
export type ApiRequest = <T>(method: "GET" | "POST" | "PATCH", path: string, body?: unknown) => Promise<WalletResponse<T>>;

const ApiContext = React.createContext<ApiRequest | null>(null);

export function ApiProvider({ request, children }: { request: ApiRequest; children: React.ReactNode }) {
  return <ApiContext.Provider value={request}>{children}</ApiContext.Provider>;
}

export function useApi(): ApiRequest {
  const request = React.useContext(ApiContext);
  if (!request) throw new Error("useApi must be used inside ApiProvider");
  return request;
}

export type LoadState<T> = { status: "loading" } | { status: "ready"; value: T } | { status: "error" };

/**
 * GETs `path` and keeps the answer; `null` waits. Reloads when the path
 * changes or `reload()` is called, keeping the last value on screen meanwhile.
 */
export function useResource<T>(path: string | null) {
  const request = useApi();
  const [state, setState] = React.useState<LoadState<T> & { path?: string | null }>({ status: "loading" });
  const [reloadKey, setReloadKey] = React.useState(0);

  React.useEffect(() => {
    if (!path) return;
    let active = true;
    // A reload of the same path keeps the old value on screen; a new path starts empty.
    setState((previous) => (previous.status === "ready" && previous.path === path ? previous : { status: "loading", path }));
    request<T>("GET", path).then(
      (response) =>
        active && setState(response.ok ? { status: "ready", value: response.value, path } : { status: "error", path }),
      () => active && setState({ status: "error", path }),
    );
    return () => {
      active = false;
    };
  }, [request, path, reloadKey]);

  const reload = React.useCallback(() => setReloadKey((key) => key + 1), []);
  return { state: state as LoadState<T>, reload };
}
