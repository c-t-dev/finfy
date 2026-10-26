"use client";

import * as React from "react";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@packages/ui/components/card";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { Spinner } from "@packages/ui/components/spinner";
import { PASSWORD_MAX, PASSWORD_MIN, passwordProblem, AUTH_ERRORS, type AuthError } from "@packages/shared/auth";
import { useApi } from "./api";
import { ErrorMessage, type AuthFailure } from "./auth";
import { useTranslations } from "./i18n";

/** The signed-in user as the host knows it; `onChanged` lets the host reload it. */
export interface AppUser {
  name: string;
  email: string;
}

const UserContext = React.createContext<{ user: AppUser; onChanged: () => void } | null>(null);

export function UserProvider({ user, onChanged, children }: { user: AppUser; onChanged: () => void; children: React.ReactNode }) {
  const value = React.useMemo(() => ({ user, onChanged }), [user, onChanged]);
  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const value = React.useContext(UserContext);
  if (!value) throw new Error("useUser must be used inside UserProvider");
  return value;
}

const toFailure = (response: { ok: boolean; error?: string; retryAfterSeconds?: number }): AuthFailure | null =>
  response.ok
    ? null
    : {
        error: AUTH_ERRORS.includes(response.error as AuthError) ? (response.error as AuthError) : "unavailable",
        retryAfterSeconds: response.retryAfterSeconds,
      };

export function AccountCard() {
  const t = useTranslations("app.account");
  const common = useTranslations("common");
  const request = useApi();
  const { user, onChanged } = useUser();
  const [name, setName] = React.useState(user.name);
  const [savedName, setSavedName] = React.useState(false);
  const [nameFailure, setNameFailure] = React.useState<AuthFailure | null>(null);
  const [pendingName, setPendingName] = React.useState(false);

  const [current, setCurrent] = React.useState("");
  const [next, setNext] = React.useState("");
  const [confirm, setConfirm] = React.useState("");
  const [mismatch, setMismatch] = React.useState(false);
  const [passwordDone, setPasswordDone] = React.useState(false);
  const [passwordFailure, setPasswordFailure] = React.useState<AuthFailure | null>(null);
  const [pendingPassword, setPendingPassword] = React.useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setPendingName(true);
            setSavedName(false);
            const response = await request("POST", "/api/account/profile", { name: name.trim() }).catch(() => ({ ok: false as const, error: "unavailable" as const }));
            setPendingName(false);
            setNameFailure(toFailure(response));
            if (response.ok) {
              setSavedName(true);
              onChanged();
            }
          }}
        >
          <ErrorMessage failure={nameFailure} />
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-name">{t("name")}</Label>
              <Input id="account-name" value={name} onChange={(event) => { setName(event.target.value); setSavedName(false); }} required maxLength={100} autoComplete="name" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="account-email">{t("email")}</Label>
              <Input id="account-email" value={user.email} readOnly disabled />
              <p className="text-[11px] text-muted-foreground">{t("emailNote")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button type="submit" disabled={pendingName || !name.trim() || name.trim() === user.name}>
              {pendingName ? <Spinner label={common("loading")} /> : t("save")}
            </Button>
            {savedName && <span role="status" className="text-[12px] text-muted-foreground">{t("saved")}</span>}
          </div>
        </form>

        <form
          className="flex flex-col gap-3 border-t border-border/60 pt-5"
          onSubmit={async (event) => {
            event.preventDefault();
            setPasswordDone(false);
            if (next !== confirm) return setMismatch(true);
            setMismatch(false);
            // Same rules as the server, checked first to save a round trip.
            const problem = passwordProblem(next, user.email);
            if (problem) return setPasswordFailure({ error: problem });
            setPendingPassword(true);
            const response = await request("POST", "/api/account/password", { currentPassword: current, newPassword: next }).catch(() => ({ ok: false as const, error: "unavailable" as const }));
            setPendingPassword(false);
            setPasswordFailure(toFailure(response));
            if (response.ok) {
              setPasswordDone(true);
              setCurrent("");
              setNext("");
              setConfirm("");
            }
          }}
        >
          <h3 className="text-[13px] font-semibold">{t("password.title")}</h3>
          <ErrorMessage failure={passwordFailure} />
          {mismatch && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{t("password.mismatch")}</p>}
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password-current">{t("password.current")}</Label>
              <Input id="password-current" type="password" value={current} onChange={(event) => setCurrent(event.target.value)} required autoComplete="current-password" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password-new">{t("password.new")}</Label>
              <Input id="password-new" type="password" value={next} onChange={(event) => setNext(event.target.value)} required minLength={PASSWORD_MIN} maxLength={PASSWORD_MAX} autoComplete="new-password" />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password-confirm">{t("password.confirm")}</Label>
              <Input id="password-confirm" type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} required autoComplete="new-password" />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button type="submit" variant="secondary" disabled={pendingPassword || !current || !next || !confirm}>
              {pendingPassword ? <Spinner label={common("loading")} /> : t("password.save")}
            </Button>
            {passwordDone && <span role="status" className="text-[12px] text-muted-foreground">{t("password.done")}</span>}
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
