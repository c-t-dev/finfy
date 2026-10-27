"use client";

import * as React from "react";
import { CheckIcon, CopyIcon, LogOutIcon, MoreHorizontalIcon, RefreshCwIcon, Share2Icon, UserMinusIcon, UserPlusIcon, XIcon } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@packages/ui/components/dropdown-menu";
import { Input } from "@packages/ui/components/input";
import { Label } from "@packages/ui/components/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@packages/ui/components/select";
import { Spinner } from "@packages/ui/components/spinner";
import { ResourceFeedback } from "./loading";
import { newId } from "@packages/shared/ids";
import { INVITE_ROLES, type InviteLink, type Member, type Members } from "@packages/shared/members";
import { canChangeRole, canInvite, canRemoveMember, type WalletRole } from "@packages/shared/roles";
import type { Wallet } from "@packages/shared/wallets";
import { useApi, useResource } from "./api";
import { ConfirmDialog, useShortDate } from "./cards-ui";
import { useTranslations } from "./i18n";
import { APP_BASE } from "./navigation";
import { useWalletRequest, WalletErrorMessage } from "./wallet-ui";
import { useWallets } from "./wallets";

type InviteRole = (typeof INVITE_ROLES)[number];

/**
 * Where an invite link points. The web app opens it on its own origin; the
 * Tauri and Capacitor builds will need the public web address instead.
 */
const inviteUrl = (token: string) => `${window.location.origin}${APP_BASE}/invites/${token}`;

export function MembersCard({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.members");
  const roles = useTranslations("app.wallet.roles");
  const shortDate = useShortDate();
  const request = useApi();
  const { select, wallets } = useWallets();
  const data = useResource<Members>(`/api/wallets/${wallet.id}/members`);
  const [inviting, setInviting] = React.useState(false);
  const [link, setLink] = React.useState<InviteLink | null>(null);
  const [removing, setRemoving] = React.useState<Member | null>(null);
  const [leaving, setLeaving] = React.useState(false);
  const base = `/api/wallets/${wallet.id}`;
  const mayInvite = INVITE_ROLES.some((role) => canInvite(wallet.role, role));

  const act = async (path: string, body: unknown) => {
    await request("POST", path, body).catch(() => null);
    data.reload();
  };

  const members = data.state.status === "ready" ? data.state.value.members : [];
  const invites = data.state.status === "ready" ? data.state.value.invites : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("title")}</CardTitle>
        <CardDescription>{t("body")}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <ResourceFeedback state={data.state} reload={data.reload} />
        <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
          {members.map((member) => {
            const otherRoles = INVITE_ROLES.filter(
              (role) => role !== member.role && canChangeRole(wallet.role, member.role, role, member.isMe),
            );
            const removable = canRemoveMember(wallet.role, member.role, member.isMe);
            return (
              <li key={member.id} className="flex items-center gap-3 px-3 py-2.5">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/12 text-[13px] font-semibold text-primary" aria-hidden>
                  {member.name.slice(0, 1).toUpperCase()}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">
                    {member.name}
                    {member.isMe && <span className="font-normal text-muted-foreground"> · {t("you")}</span>}
                  </div>
                  <div className="truncate text-[12px] text-muted-foreground">{member.email}</div>
                </div>
                <div className="text-right">
                  <div className="text-[12px] font-medium">{roles(member.role)}</div>
                  <div className="text-[11px] text-muted-foreground max-sm:hidden">{t(`roleHints.${member.role}`)}</div>
                </div>
                {(otherRoles.length > 0 || removable) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon-sm" aria-label={t("actions.menu", { name: member.name })}>
                        <MoreHorizontalIcon />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {otherRoles.map((role) => (
                        <DropdownMenuItem key={role} onSelect={() => void act(`${base}/members/${member.id}/role`, { mutationId: newId(), role })}>
                          {t("actions.role", { role: roles(role) })}
                        </DropdownMenuItem>
                      ))}
                      {removable && (
                        <DropdownMenuItem onSelect={() => setRemoving(member)}>
                          <UserMinusIcon aria-hidden />
                          {t("actions.remove")}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </li>
            );
          })}
        </ul>

        {invites.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <h3 className="text-[12px] font-medium text-muted-foreground">{t("pending")}</h3>
            <ul className="divide-y divide-border/60 overflow-hidden rounded-lg border border-border">
              {invites.map((invite) => (
                <li key={invite.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px]">{invite.email}</div>
                    <div className={invite.expired ? "text-[11px] text-destructive" : "text-[11px] text-muted-foreground"}>
                      {roles(invite.role)} · {invite.expired ? t("expired") : t("expires", { date: shortDate(invite.expiresAt.slice(0, 10)) })}
                    </div>
                  </div>
                  {canInvite(wallet.role, invite.role) && (
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={async () => {
                          const response = await request<InviteLink>("POST", `${base}/invites/${invite.id}/renew`, { mutationId: newId() });
                          if (response.ok) setLink(response.value);
                          data.reload();
                        }}
                      >
                        <RefreshCwIcon />
                        {t("renew")}
                      </Button>
                      <Button variant="ghost" size="sm" className="text-destructive" onClick={() => void act(`${base}/invites/${invite.id}/revoke`, { mutationId: newId() })}>
                        <XIcon />
                        {t("revoke")}
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {mayInvite && (
            <Button onClick={() => setInviting(true)}>
              <UserPlusIcon />
              {t("invite")}
            </Button>
          )}
          {wallet.role !== "OWNER" && (
            <Button variant="ghost" className="text-destructive" onClick={() => setLeaving(true)}>
              <LogOutIcon />
              {t("leave")}
            </Button>
          )}
        </div>
        {mayInvite && <p className="text-[11px] text-muted-foreground">{t("noEmailNote")}</p>}
      </CardContent>

      <InviteDialog
        wallet={wallet}
        open={inviting}
        onClose={() => setInviting(false)}
        onCreated={(created) => {
          setInviting(false);
          setLink(created);
          data.reload();
        }}
      />
      <InviteLinkDialog link={link} onClose={() => setLink(null)} />
      <ConfirmDialog
        open={removing !== null}
        title={t("removeTitle", { name: removing?.name ?? "" })}
        body={t("removeBody")}
        confirm={t("removeConfirm")}
        cancel={t("cancel")}
        onClose={() => setRemoving(null)}
        action={() => request("POST", `${base}/members/${removing!.id}/remove`, { mutationId: newId() })}
        onDone={() => {
          setRemoving(null);
          data.reload();
        }}
      />
      <ConfirmDialog
        open={leaving}
        title={t("leaveTitle", { name: wallet.name })}
        body={t("leaveBody")}
        confirm={t("leaveConfirm")}
        cancel={t("cancel")}
        onClose={() => setLeaving(false)}
        action={() => request("POST", `${base}/leave`, { mutationId: newId() })}
        onDone={() => {
          setLeaving(false);
          // The wallet is gone for this user: reload the app on another wallet.
          const next = wallets.find((item) => item.id !== wallet.id);
          if (next) select(next.id);
          window.location.assign(APP_BASE);
        }}
      />
    </Card>
  );
}

function InviteDialog({
  wallet,
  open,
  onClose,
  onCreated,
}: {
  wallet: Wallet;
  open: boolean;
  onClose: () => void;
  onCreated: (link: InviteLink) => void;
}) {
  const t = useTranslations("app.members");
  const roles = useTranslations("app.wallet.roles");
  const common = useTranslations("common");
  const request = useApi();
  const allowed = INVITE_ROLES.filter((role) => canInvite(wallet.role, role as WalletRole));
  const [email, setEmail] = React.useState("");
  const [role, setRole] = React.useState<InviteRole>("EDITOR");
  const { pending, failure, setFailure, run } = useWalletRequest();

  React.useEffect(() => {
    if (open) {
      setEmail("");
      setFailure(null);
    }
  }, [open, setFailure]);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            let created: InviteLink | null = null;
            const ok = await run(async () => {
              const response = await request<InviteLink>("POST", `/api/wallets/${wallet.id}/invites`, { mutationId: newId(), email: email.trim(), role });
              if (response.ok) created = response.value;
              return response;
            });
            if (ok && created) onCreated(created);
          }}
        >
          <DialogHeader>
            <DialogTitle>{t("form.title", { wallet: wallet.name })}</DialogTitle>
            <DialogDescription>{t("noEmailNote")}</DialogDescription>
          </DialogHeader>
          <WalletErrorMessage failure={failure} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-email">{t("form.email")}</Label>
            <Input id="invite-email" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="invite-role">{t("form.role")}</Label>
            <Select value={role} onValueChange={(value) => setRole(value as InviteRole)}>
              <SelectTrigger id="invite-role">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {allowed.map((value) => (
                  <SelectItem key={value} value={value}>
                    {roles(value)} · {t(`roleHints.${value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={pending || !email.trim()}>
              {pending ? <Spinner label={common("loading")} /> : t("form.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InviteLinkDialog({ link, onClose }: { link: InviteLink | null; onClose: () => void }) {
  const t = useTranslations("app.members.link");
  const common = useTranslations("common");
  const [copied, setCopied] = React.useState(false);
  const url = link ? inviteUrl(link.token) : "";
  const canShare = typeof navigator !== "undefined" && "share" in navigator;

  React.useEffect(() => setCopied(false), [link]);

  return (
    <Dialog open={link !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("title", { email: link?.invite.email ?? "" })}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        <Input readOnly value={url} onFocus={(event) => event.currentTarget.select()} className="font-mono text-[12px]" aria-label={t("title", { email: link?.invite.email ?? "" })} />
        <DialogFooter>
          {canShare && (
            <Button variant="secondary" onClick={() => void navigator.share({ url }).catch(() => null)}>
              <Share2Icon />
              {t("share")}
            </Button>
          )}
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard.writeText(url).catch(() => null);
              setCopied(true);
            }}
          >
            {copied ? <CheckIcon /> : <CopyIcon />}
            {copied ? t("copied") : t("copy")}
          </Button>
          <Button onClick={onClose}>{t("done")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
