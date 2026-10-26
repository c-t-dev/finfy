"use client";

import * as React from "react";
import { ArchiveIcon, ArchiveRestoreIcon, CheckIcon, MoreHorizontalIcon, PencilIcon, PlusIcon } from "lucide-react";
import { Button } from "@packages/ui/components/button";
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
import { Spinner } from "@packages/ui/components/spinner";
import { cn } from "@packages/ui/lib/utils";
import { ACCOUNT_COLORS, type AccountColor } from "@packages/shared/accounts";
import { newId } from "@packages/shared/ids";
import { can } from "@packages/shared/roles";
import { TAG_NAME_MAX, TAGS_PER_ENTRY_MAX, type Tag } from "@packages/shared/tags";
import type { Wallet } from "@packages/shared/wallets";
import { useApi, useResource } from "./api";
import { COLOR_BG } from "./categories";
import { useTranslations } from "./i18n";
import { useWalletRequest, WalletErrorMessage } from "./wallet-ui";

/** The wallet's active tags, plus a way to add one the server just answered. */
export function useTags(walletId: string | null) {
  const { state, reload } = useResource<{ tags: Tag[] }>(walletId ? `/api/wallets/${walletId}/tags` : null);
  const [extra, setExtra] = React.useState<Tag[]>([]);
  const tags = React.useMemo(() => {
    const list = state.status === "ready" ? state.value.tags : [];
    const known = new Set(list.map((tag) => tag.id));
    return [...list, ...extra.filter((tag) => !known.has(tag.id))];
  }, [state, extra]);
  const add = React.useCallback((tag: Tag) => setExtra((list) => [...list, tag]), []);
  return { tags, byId: React.useMemo(() => new Map(tags.map((tag) => [tag.id, tag])), [tags]), reload, add };
}

export function TagChip({ tag, className }: { tag: Pick<Tag, "name" | "color">; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full bg-foreground/8 px-1.5 py-px text-[10px] font-medium", className)}>
      <span className={cn("size-1.5 rounded-full", COLOR_BG[tag.color])} aria-hidden />
      {tag.name}
    </span>
  );
}

/** Toggle the wallet's tags on an entry, or create one by typing its name. */
export function TagPicker({
  wallet,
  tags,
  value,
  onChange,
  onCreated,
}: {
  wallet: Wallet;
  tags: Tag[];
  value: string[];
  onChange: (value: string[]) => void;
  onCreated: (tag: Tag) => void;
}) {
  const t = useTranslations("app.tags");
  const request = useApi();
  const [draft, setDraft] = React.useState("");
  const [pending, setPending] = React.useState(false);
  const full = value.length >= TAGS_PER_ENTRY_MAX;

  const create = async () => {
    const name = draft.trim();
    if (!name || full) return;
    setPending(true);
    const response = await request<Tag>("POST", `/api/wallets/${wallet.id}/tags`, {
      id: newId(),
      mutationId: newId(),
      name,
      color: ACCOUNT_COLORS[(tags.length + 3) % ACCOUNT_COLORS.length],
    }).catch(() => null);
    setPending(false);
    if (!response?.ok) return;
    onCreated(response.value);
    if (!value.includes(response.value.id)) onChange([...value, response.value.id]);
    setDraft("");
  };

  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor="entry-tag-new">{t("label")}</Label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={t("label")}>
        {tags.map((tag) => {
          const on = value.includes(tag.id);
          return (
            <button
              key={tag.id}
              type="button"
              aria-pressed={on}
              disabled={!on && full}
              onClick={() => onChange(on ? value.filter((id) => id !== tag.id) : [...value, tag.id])}
              className={cn(
                "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[12px] outline-none transition-colors focus-visible:ring-[3px] focus-visible:ring-ring/40 disabled:opacity-40",
                on ? "border-primary bg-primary/12 text-primary" : "border-border bg-card hover:bg-foreground/5",
              )}
            >
              {on ? <CheckIcon className="size-3" aria-hidden /> : <span className={cn("size-1.5 rounded-full", COLOR_BG[tag.color])} aria-hidden />}
              {tag.name}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2">
        <Input
          id="entry-tag-new"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              void create();
            }
          }}
          maxLength={TAG_NAME_MAX}
          placeholder={t("newPlaceholder")}
          disabled={full}
          className="h-7"
        />
        <Button type="button" variant="secondary" size="sm" disabled={pending || !draft.trim() || full} onClick={() => void create()}>
          <PlusIcon />
          {t("add")}
        </Button>
      </div>
    </div>
  );
}

/** Saves an entry's tags when they changed (the entry's own form saves the rest). */
export async function saveEntryTags(
  request: ReturnType<typeof useApi>,
  walletId: string,
  entryId: string,
  before: string[],
  after: string[],
) {
  const same = before.length === after.length && before.every((id) => after.includes(id));
  if (same) return { ok: true as const, value: null };
  return request("POST", `/api/wallets/${walletId}/transactions/${entryId}/tags`, { mutationId: newId(), tagIds: after });
}

/** Tags tab of the categories screen. */
export function TagsManager({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.tags");
  const request = useApi();
  const canEdit = can(wallet.role, "editEntries");
  const { tags, reload } = useTags(wallet.id);
  const [showArchived, setShowArchived] = React.useState(false);
  const archived = useResource<{ tags: Tag[] }>(showArchived ? `/api/wallets/${wallet.id}/tags?archived=1` : null);
  const [editing, setEditing] = React.useState<{ tag: Tag | null } | null>(null);
  const refresh = () => {
    reload();
    if (showArchived) archived.reload();
  };
  const act = async (path: string) => {
    await request("POST", path, { mutationId: newId() }).catch(() => null);
    refresh();
  };

  return (
    <section className="flex flex-col gap-3">
      {canEdit && (
        <Button className="self-end" onClick={() => setEditing({ tag: null })}>
          <PlusIcon />
          {t("form.createTitle")}
        </Button>
      )}
      {tags.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card/50 px-6 py-8 text-center">
          <p className="text-[13px] font-medium">{t("empty")}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">{t("emptyHint")}</p>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card">
          {tags.map((tag) => (
            <li key={tag.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className={cn("size-2.5 rounded-full", COLOR_BG[tag.color])} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-[13px]">{tag.name}</span>
              {canEdit && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon-sm" aria-label={t("actions.menu", { name: tag.name })}>
                      <MoreHorizontalIcon />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onSelect={() => setEditing({ tag })}>
                      <PencilIcon aria-hidden />
                      {t("actions.edit")}
                    </DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => void act(`/api/wallets/${wallet.id}/tags/${tag.id}/archive`)}>
                      <ArchiveIcon aria-hidden />
                      {t("actions.archive")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          ))}
        </ul>
      )}
      <Button variant="link" size="sm" className="self-start px-0" onClick={() => setShowArchived((show) => !show)}>
        {showArchived ? t("archived.hide") : t("archived.show")}
      </Button>
      {showArchived &&
        archived.state.status === "ready" &&
        (archived.state.value.tags.length === 0 ? (
          <p className="text-[13px] text-muted-foreground">{t("archived.empty")}</p>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card/60">
            {archived.state.value.tags.map((tag) => (
              <li key={tag.id} className="flex items-center gap-3 px-4 py-2.5">
                <span className="min-w-0 flex-1 truncate text-[13px]">{tag.name}</span>
                {canEdit && (
                  <Button variant="ghost" size="sm" onClick={() => void act(`/api/wallets/${wallet.id}/tags/${tag.id}/restore`)}>
                    <ArchiveRestoreIcon />
                    {t("actions.restore")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ))}
      <TagFormDialog
        wallet={wallet}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          refresh();
        }}
      />
    </section>
  );
}

function TagFormDialog({
  wallet,
  editing,
  onClose,
  onSaved,
}: {
  wallet: Wallet;
  editing: { tag: Tag | null } | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("app.tags.form");
  const colors = useTranslations("app.accounts.colors");
  const common = useTranslations("common");
  const request = useApi();
  const tag = editing?.tag ?? null;
  const [name, setName] = React.useState("");
  const [color, setColor] = React.useState<AccountColor>("blue");
  const { pending, failure, setFailure, run } = useWalletRequest();

  React.useEffect(() => {
    if (editing) {
      setName(editing.tag?.name ?? "");
      setColor(editing.tag?.color ?? "blue");
      setFailure(null);
    }
  }, [editing, setFailure]);

  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-sm">
        <form
          className="flex flex-col gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            const ok = await run(() =>
              tag
                ? request("PATCH", `/api/wallets/${wallet.id}/tags/${tag.id}`, {
                    mutationId: newId(),
                    name: name.trim() !== tag.name ? name.trim() : undefined,
                    color: color !== tag.color ? color : undefined,
                  })
                : request("POST", `/api/wallets/${wallet.id}/tags`, { id: newId(), mutationId: newId(), name: name.trim(), color }),
            );
            if (ok) onSaved();
          }}
        >
          <DialogHeader>
            <DialogTitle>{tag ? t("editTitle") : t("createTitle")}</DialogTitle>
            <DialogDescription className="sr-only">{t("name")}</DialogDescription>
          </DialogHeader>
          <WalletErrorMessage failure={failure} />
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="tag-name">{t("name")}</Label>
            <Input id="tag-name" value={name} onChange={(event) => setName(event.target.value)} required autoFocus maxLength={TAG_NAME_MAX} />
          </div>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[13px] font-medium">{t("color")}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {ACCOUNT_COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={color === value}
                  aria-label={colors(value)}
                  onClick={() => setColor(value)}
                  className={cn("size-6 rounded-full outline-none ring-offset-2 ring-offset-card focus-visible:ring-[3px] focus-visible:ring-ring/40", COLOR_BG[value], color === value && "ring-2 ring-foreground/70")}
                />
              ))}
            </div>
          </fieldset>
          <DialogFooter>
            <Button type="button" variant="secondary" onClick={onClose}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={pending || !name.trim()}>
              {pending ? <Spinner label={common("loading")} /> : tag ? t("save") : t("create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
