"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@packages/ui/components/card";
import { Input } from "@packages/ui/components/input";
import { AGENT_SCOPES, type AgentScope, type Connections, type CreatedConnection } from "@packages/shared/integrations";
import { can } from "@packages/shared/roles";
import { useApi, useResource } from "./api";
import { useTranslations } from "./i18n";
import { useWalletRequest, WalletErrorMessage } from "./wallet-ui";
import { useWallets } from "./wallets";

const path = "/api/integrations";

export function IntegrationsCard() {
  const t = useTranslations("app.integrations");
  const api = useApi();
  const { wallets } = useWallets();
  const { state, reload } = useResource<Connections>(path);
  const { pending, failure, run } = useWalletRequest();
  const [token, setToken] = useState<string | null>(null);
  const [scopes, setScopes] = useState<AgentScope[]>([]);
  const eligibleWallets = wallets.filter(wallet => scopes.every(scope =>
    can(wallet.role, scope === "invoices:read" ? "view" : "editEntries")));

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    if (await run(async () => {
      const result = await api<CreatedConnection>("POST", path, {
        name: data.get("name"), walletIds: data.getAll("wallet"), scopes,
      });
      if (result.ok) setToken(result.value.token);
      return result;
    })) {
      form.reset();
      setScopes([]);
      reload();
    }
  }

  async function revoke(id: string) {
    if (await run(() => api("POST", path + "/" + id + "/revoke", {}))) {
      setToken(null);
      reload();
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <WalletErrorMessage failure={failure} />
        {state.status === "loading" && <p role="status">{t("loading")}</p>}
        {state.status === "error" && <Button onClick={reload} variant="secondary">{t("retry")}</Button>}
        {state.status === "ready" && <>
          <p>{t(state.value.plan === "PAID" ? "paid" : "free")}</p>
          {state.value.connections.length > 0 && <ul className="space-y-3">
            {state.value.connections.map(connection => <li key={connection.id} className="space-y-1">
              <p className="font-medium">{connection.name}</p>
              <p className="text-sm text-muted-foreground">
                {connection.walletIds.map(id => wallets.find(wallet => wallet.id === id)?.name ?? t("unavailableWallet")).join(", ")}
              </p>
              <p className="text-sm text-muted-foreground">{connection.scopes.map(scope => t(scope)).join(", ")}</p>
              {connection.revoked ? <p>{t("revoked")}</p>
                : <Button variant="secondary" disabled={pending} onClick={() => void revoke(connection.id)}>{t("revoke")}</Button>}
            </li>)}
          </ul>}
          {token ? <div className="space-y-2">
            <label className="block">{t("secret")}<Input readOnly autoComplete="off" spellCheck={false} value={token} onFocus={event => event.currentTarget.select()} /></label>
            <Button variant="secondary" onClick={() => setToken(null)}>{t("dismiss")}</Button>
          </div> : state.value.plan === "PAID" && <form onSubmit={create} className="space-y-3">
            <label className="block">{t("name")}<Input name="name" required maxLength={80} /></label>
            <fieldset className="space-y-1">
              <legend>{t("scopes")}</legend>
              {AGENT_SCOPES.map(scope => <label key={scope} className="flex items-center gap-2">
                <input type="checkbox" checked={scopes.includes(scope)} onChange={event => {
                  setScopes(event.target.checked ? [...scopes, scope] : scopes.filter(value => value !== scope));
                }} />
                {t(scope)}
              </label>)}
            </fieldset>
            <fieldset className="space-y-1">
              <legend>{t("wallets")}</legend>
              {eligibleWallets.map(wallet => <label key={wallet.id} className="flex items-center gap-2">
                <input type="checkbox" name="wallet" value={wallet.id} />{wallet.name}
              </label>)}
              {eligibleWallets.length === 0 && <p>{t("noWallets")}</p>}
            </fieldset>
            <Button disabled={pending || !scopes.length || !eligibleWallets.length}>{t("create")}</Button>
          </form>}
        </>}
      </CardContent>
    </Card>
  );
}
