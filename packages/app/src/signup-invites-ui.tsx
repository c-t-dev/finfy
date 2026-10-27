"use client";

import * as React from "react";
import { CheckIcon, CopyIcon, Share2Icon, TicketIcon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@packages/ui/components/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@packages/ui/components/dialog";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { Spinner } from "@packages/ui/components/spinner";
import { ResourceFeedback } from "./loading";
import { AUTH_ERRORS, type AuthError } from "@packages/shared/auth";
import {
  SIGNUP_INVITE_DAYS,
  SIGNUP_INVITE_NOTE_MAX,
  type CreatedSignupInvite,
  type SignupInvite,
  type SignupInviteList,
} from "@packages/shared/signup-invites";
import { useApi, useResource } from "./api";
import { ErrorMessage, type AuthFailure } from "./auth";
import { ConfirmDialog } from "./cards-ui";
import { useFormatter, useTranslations } from "./i18n";

const PATH = "/api/account/signup-invites";

/**
 * Where an invite link points: the sign-up page on this origin, with the code.
 * The Tauri and Capacitor builds will need the public web origin instead.
 */
const signUpUrl = (code: string) => `${window.location.origin}/sign-up?code=${encodeURIComponent(code)}`;

/** Settings card: codes that let someone create an account while sign-up is closed. */
export function SignupInvitesCard() {
  const t = useTranslations("app.signupInvites");
  const common = useTranslations("common");
  const request = useApi();
  const { state, reload } = useResource<SignupInviteList>(PATH);
  const [note, setNote] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const [failure, setFailure] = React.useState<AuthFailure | null>(null);
  const [created, setCreated] = React.useState<CreatedSignupInvite | null>(null);
  const [revoking, setRevoking] = React.useState<SignupInvite | null>(null);
  const list = state.status === "ready" ? state.value : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>
          {t("body", { days: SIGNUP_INVITE_DAYS })}
          {list && !list.signUpClosed && ` ${t("openNote")}`}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ResourceFeedback state={state} reload={reload} />
        <form
          className="flex flex-col gap-3"
          onSubmit={async (event) => {
            event.preventDefault();
            setPending(true);
            const response = await request<CreatedSignupInvite>("POST", PATH, note.trim() ? { note: note.trim() } : {}).catch(() => ({ ok: false as const, error: "unavailable" }));
            setPending(false);
            if (!response.ok) {
              const error = (response as { error?: string }).error;
              return setFailure({
                error: AUTH_ERRORS.includes(error as AuthError) ? (error as AuthError) : "unavailable",
                retryAfterSeconds: (response as { retryAfterSeconds?: number }).retryAfterSeconds,
              });
            }
            setFailure(null);
            setNote("");
            setCreated(response.value);
            reload();
          }}
        >
          <ErrorMessage failure={failure} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="signup-invite-note">{t("note")}</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="signup-invite-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                maxLength={SIGNUP_INVITE_NOTE_MAX}
                placeholder={t("notePlaceholder")}
                className="min-w-0 flex-1 basis-48"
              />
              <Button type="submit" disabled={pending}>
                {pending ? <Spinner label={common("loading")} /> : <TicketIcon />}
                {t("create")}
              </Button>
            </div>
          </div>
        </form>

        {list && list.invites.length > 0 && (
          <ul className="flex flex-col divide-y divide-border/60 border-t border-border/60">
            {list.invites.map((invite) => (
              <InviteRow key={invite.id} invite={invite} onRevoke={() => setRevoking(invite)} />
            ))}
          </ul>
        )}
      </CardContent>

      <CodeDialog created={created} onClose={() => setCreated(null)} />
      <ConfirmDialog
        open={revoking !== null}
        title={t("revoke.title")}
        body={t("revoke.body")}
        confirm={t("revoke.confirm")}
        cancel={t("revoke.cancel")}
        onClose={() => setRevoking(null)}
        action={() => request("POST", `${PATH}/${revoking!.id}/revoke`)}
        onDone={() => {
          setRevoking(null);
          reload();
        }}
      />
    </Card>
  );
}

function InviteRow({ invite, onRevoke }: { invite: SignupInvite; onRevoke: () => void }) {
  const t = useTranslations("app.signupInvites");
  const format = useFormatter();
  const date = (iso: string) => format.dateTime(new Date(iso), { day: "numeric", month: "short" });
  const detail =
    invite.status === "PENDING"
      ? t("status.PENDING", { date: date(invite.expiresAt) })
      : invite.status === "USED"
        ? t("status.USED", { name: invite.usedByName ?? "", date: date(invite.usedAt!) })
        : invite.status === "EXPIRED"
          ? t("status.EXPIRED", { date: date(invite.expiresAt) })
          : t("status.REVOKED");
  return (
    <li className="flex items-center gap-3 py-2.5">
      <div className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-[13px]">{invite.note || t("noNote")}</span>
        <span className="text-[11px] text-muted-foreground">
          {t("created", { date: date(invite.createdAt) })} · {detail}
        </span>
      </div>
      {invite.status === "PENDING" && (
        <Button variant="ghost" size="sm" onClick={onRevoke}>
          {t("revoke.action")}
        </Button>
      )}
    </li>
  );
}

function CodeDialog({ created, onClose }: { created: CreatedSignupInvite | null; onClose: () => void }) {
  const t = useTranslations("app.signupInvites.dialog");
  const common = useTranslations("common");
  const [copied, setCopied] = React.useState<"code" | "link" | null>(null);
  // Keeps the last code on screen while the dialog fades out.
  const [shown, setShown] = React.useState(created);
  if (created && created !== shown) setShown(created);
  const url = shown ? signUpUrl(shown.code) : "";
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  React.useEffect(() => setCopied(null), [created]);

  const copy = async (what: "code" | "link") => {
    await navigator.clipboard.writeText(what === "code" ? shown!.code : url).catch(() => null);
    setCopied(what);
  };

  return (
    <Dialog open={created !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title")}</DialogTitle>
          <DialogDescription>{t("body", { days: SIGNUP_INVITE_DAYS })}</DialogDescription>
        </DialogHeader>
        <p className="select-all rounded-md bg-muted px-3 py-3 text-center font-mono text-lg font-semibold tracking-wider" aria-label={t("code")}>
          {shown?.code}
        </p>
        <Input readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="font-mono text-[12px]" aria-label={t("link")} />
        <DialogFooter>
          {canShare && (
            <Button variant="secondary" onClick={() => void navigator.share({ url }).catch(() => null)}>
              <Share2Icon />
              {t("share")}
            </Button>
          )}
          <Button variant="secondary" onClick={() => void copy("code")}>
            {copied === "code" ? <CheckIcon /> : <CopyIcon />}
            {copied === "code" ? t("copied") : t("copyCode")}
          </Button>
          <Button variant="secondary" onClick={() => void copy("link")}>
            {copied === "link" ? <CheckIcon /> : <CopyIcon />}
            {copied === "link" ? t("copied") : t("copyLink")}
          </Button>
          <Button onClick={onClose}>{t("done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
