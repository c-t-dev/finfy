"use client";

import * as React from "react";
import { MailOpenIcon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
import { Spinner } from "@packages/ui/components/spinner";
import { LoadingList, ResourceFeedback } from "../loading";
import { newId } from "@packages/shared/ids";
import type { InvitePreview } from "@packages/shared/members";
import { useApi, useResource } from "../api";
import { useTranslations } from "../i18n";
import { APP_BASE } from "../navigation";
import { useWalletRequest, WalletErrorMessage } from "../wallet-ui";

/**
 * Opened from an invite link. Accepting needs this link and the invited
 * account; afterwards the app reloads on the new wallet (the host remembers
 * it through `onAccepted`).
 */
export function InviteScreen({ token, onAccepted }: { token: string; onAccepted: (walletId: string) => void }) {
  const t = useTranslations("app.invite");
  const roles = useTranslations("app.wallet.roles");
  const request = useApi();
  const preview = useResource<InvitePreview>(`/api/invites/${token}`);
  const [declined, setDeclined] = React.useState(false);
  const { pending, failure, run } = useWalletRequest();

  const respond = async (accept: boolean) => {
    let walletId: string | null = null;
    const ok = await run(async () => {
      const response = await request<{ walletId: string }>("POST", `/api/invites/${token}/${accept ? "accept" : "decline"}`, { mutationId: newId() });
      if (response.ok) walletId = response.value.walletId;
      return response;
    });
    if (!ok) return;
    if (accept && walletId) onAccepted(walletId);
    else setDeclined(true);
  };

  const body = (() => {
    if (preview.state.status === "loading") return <LoadingList rows={2} />;
    if (preview.state.status === "error") return <ResourceFeedback state={preview.state} reload={preview.reload} />;
    const invite = preview.state.value;
    if (declined) return <p className="text-[13px] text-muted-foreground">{t("declined")}</p>;
    if (invite.alreadyMember) return <p className="text-[13px] text-muted-foreground">{t("alreadyMember")}</p>;
    if (invite.status === "EXPIRED") return <p className="text-[13px] text-muted-foreground">{t("expired")}</p>;
    if (invite.status === "USED") return <p className="text-[13px] text-muted-foreground">{t("used")}</p>;
    return (
      <>
        <p className="text-[14px]">
          {t("body", { inviter: invite.invitedByName, wallet: invite.walletName, role: roles(invite.role) })}
        </p>
        {!invite.matchesAccount && <p className="rounded-md bg-destructive/10 px-3 py-2 text-[12px] text-destructive">{t("wrongAccount", { email: invite.email })}</p>}
        <WalletErrorMessage failure={failure} />
        {invite.matchesAccount && (
          <div className="flex gap-2">
            <Button disabled={pending} onClick={() => void respond(true)}>
              {pending ? <Spinner label={t("accept")} /> : t("accept")}
            </Button>
            <Button variant="secondary" disabled={pending} onClick={() => void respond(false)}>
              {t("decline")}
            </Button>
          </div>
        )}
      </>
    );
  })();

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 rounded-xl border border-border bg-card p-6">
      <div className="flex items-center gap-3">
        <MailOpenIcon className="size-6 text-primary" aria-hidden />
        <h1 className="text-xl font-semibold">{t("title")}</h1>
      </div>
      {body}
      {(declined || preview.state.status !== "ready" || preview.state.value.status !== "PENDING" || preview.state.value.alreadyMember) && (
        <Button variant="secondary" className="self-start" onClick={() => window.location.assign(APP_BASE)}>
          {t("back")}
        </Button>
      )}
    </div>
  );
}
