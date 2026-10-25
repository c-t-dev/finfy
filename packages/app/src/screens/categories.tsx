"use client";

import * as React from "react";
import {
  ArchiveIcon,
  ArchiveRestoreIcon,
  ChevronLeftIcon,
  EyeIcon,
  EyeOffIcon,
  MoreHorizontalIcon,
  PencilIcon,
  PlusIcon,
} from "lucide-react";
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
import { SegmentedControl } from "@packages/ui/components/segmented-control";
import { Spinner } from "@packages/ui/components/spinner";
import { cn } from "@packages/ui/lib/utils";
import {
  CATEGORY_COLORS,
  CATEGORY_ICONS,
  CATEGORY_NAME_MAX,
  type Category,
  type CategoryIcon,
} from "@packages/shared/categories";
import { newId } from "@packages/shared/ids";
import { can } from "@packages/shared/roles";
import type { Wallet } from "@packages/shared/wallets";
import { useApi, useResource } from "../api";
import { CATEGORY_ICON_COMPONENTS, CategoryBadge, COLOR_BG, useCategories, useCategoryLabel } from "../categories";
import { useTranslations } from "../i18n";
import { APP_ROUTES, useAppNavigation } from "../navigation";
import { useWalletRequest, WalletErrorMessage } from "../wallet-ui";
import { useWallets } from "../wallets";

const SETTINGS_PATH = APP_ROUTES.find((route) => route.key === "settings")!.path;
type Kind = "EXPENSE" | "INCOME";

export function CategoriesScreen() {
  const t = useTranslations("app.categories");
  const { current } = useWallets();
  const { Link } = useAppNavigation();
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link href={SETTINGS_PATH} className="flex items-center gap-1 text-[13px] text-primary hover:underline">
          <ChevronLeftIcon className="size-4" aria-hidden />
          {t("back")}
        </Link>
        <h1 className="text-2xl font-semibold">{t("title")}</h1>
      </div>
      {current ? (
        <WalletCategories key={current.id} wallet={current} />
      ) : (
        <p className="text-[13px] text-muted-foreground">{t("noWallet")}</p>
      )}
    </div>
  );
}

type Editing =
  | { mode: "create"; kind: Kind; parent: Category | null }
  | { mode: "edit"; category: Category }
  | null;

function WalletCategories({ wallet }: { wallet: Wallet }) {
  const t = useTranslations("app.categories");
  const request = useApi();
  const label = useCategoryLabel();
  const canEdit = can(wallet.role, "editEntries");
  const [kind, setKind] = React.useState<Kind>("EXPENSE");
  const [showArchived, setShowArchived] = React.useState(false);
  const { state, tree, reload } = useCategories(wallet.id);
  const archived = useResource<{ categories: Category[] }>(
    showArchived ? `/api/wallets/${wallet.id}/categories?archived=1` : null,
  );
  const [editing, setEditing] = React.useState<Editing>(null);
  const [archiving, setArchiving] = React.useState<Category | null>(null);

  const base = `/api/wallets/${wallet.id}/categories`;
  const reloadAll = () => {
    reload();
    if (showArchived) archived.reload();
  };
  const act = async (path: string, body: unknown) => {
    await request("POST", path, body).catch(() => null);
    reloadAll();
  };
  const setHidden = (category: Category, hidden: boolean) =>
    act(`${base}/${category.id}/${hidden ? "hide" : "show"}`, { mutationId: newId() });

  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <SegmentedControl
          aria-label={t("title")}
          value={kind}
          onValueChange={setKind}
          options={[
            { value: "EXPENSE", label: t("tabs.EXPENSE") },
            { value: "INCOME", label: t("tabs.INCOME") },
          ]}
        />
        {canEdit && (
          <Button onClick={() => setEditing({ mode: "create", kind, parent: null })}>
            <PlusIcon />
            {t("actions.new")}
          </Button>
        )}
      </div>
      {!canEdit && <p className="text-[12px] text-muted-foreground">{t("readOnly")}</p>}

      {state.status === "loading" && <Spinner label={t("title")} />}
      {state.status === "error" && (
        <div className="flex items-center gap-3 text-[13px] text-destructive">
          {t("loadError")}
          <Button variant="secondary" size="sm" onClick={reload}>
            {t("retry")}
          </Button>
        </div>
      )}
      {tree && (
        <ul className="flex flex-col gap-3">
          {tree.groups(kind, { includeHidden: true }).map(({ parent, children }) => (
            <li key={parent.id} className="overflow-hidden rounded-xl border border-border bg-card">
              <CategoryRow
                category={parent}
                canEdit={canEdit}
                onEdit={() => setEditing({ mode: "edit", category: parent })}
                onAddChild={() => setEditing({ mode: "create", kind, parent })}
                onHide={(hidden) => void setHidden(parent, hidden)}
                onArchive={() => setArchiving(parent)}
              />
              {children.length > 0 && (
                <ul className="divide-y divide-border/50 border-t border-border/60">
                  {children.map((child) => (
                    <CategoryRow
                      key={child.id}
                      category={child}
                      parent={parent}
                      canEdit={canEdit}
                      onEdit={() => setEditing({ mode: "edit", category: child })}
                      onHide={(hidden) => void setHidden(child, hidden)}
                      onArchive={() => setArchiving(child)}
                    />
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}

      <Button variant="link" size="sm" className="self-start px-0" onClick={() => setShowArchived((show) => !show)}>
        {showArchived ? t("archived.hide") : t("archived.show")}
      </Button>
      {showArchived && archived.state.status === "ready" && (
        <ArchivedList
          categories={archived.state.value.categories.filter((category) => category.kind === kind)}
          canEdit={canEdit}
          onRestore={(category) =>
            void act(`${base}/${category.id}/restore`, { mutationId: newId(), baseVersion: category.version })
          }
          label={label}
        />
      )}

      <CategoryFormDialog
        wallet={wallet}
        editing={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          reloadAll();
        }}
      />
      <ArchiveCategoryDialog
        wallet={wallet}
        category={archiving}
        onClose={() => setArchiving(null)}
        onArchived={() => {
          setArchiving(null);
          reloadAll();
        }}
      />
    </section>
  );
}

function CategoryRow({
  category,
  parent,
  canEdit,
  onEdit,
  onAddChild,
  onHide,
  onArchive,
}: {
  category: Category;
  parent?: Category;
  canEdit: boolean;
  onEdit: () => void;
  onAddChild?: () => void;
  onHide: (hidden: boolean) => void;
  onArchive: () => void;
}) {
  const t = useTranslations("app.categories");
  const label = useCategoryLabel();
  const name = label(category);
  const Row = parent ? "li" : "div";
  return (
    <Row className={cn("flex items-center gap-3 px-4 py-2.5", parent && "pl-14", category.hidden && "opacity-50")}>
      {!parent && <CategoryBadge category={category} />}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className={cn("truncate text-[13px]", !parent && "font-medium")}>{name}</span>
        {category.hidden && (
          <span className="rounded-full bg-foreground/8 px-1.5 py-px text-[10px] text-muted-foreground">{t("hidden")}</span>
        )}
        {!category.isSystem && (
          <span className="rounded-full bg-primary/12 px-1.5 py-px text-[10px] font-medium text-primary">{t("own")}</span>
        )}
      </div>
      {canEdit && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon-sm" aria-label={t("actions.menu", { name })}>
              <MoreHorizontalIcon />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {onAddChild && !category.hidden && (
              <DropdownMenuItem onSelect={onAddChild}>
                <PlusIcon aria-hidden />
                {t("actions.newSub")}
              </DropdownMenuItem>
            )}
            {category.isSystem ? (
              <DropdownMenuItem onSelect={() => onHide(!category.hidden)}>
                {category.hidden ? <EyeIcon aria-hidden /> : <EyeOffIcon aria-hidden />}
                {category.hidden ? t("actions.show") : t("actions.hide")}
              </DropdownMenuItem>
            ) : (
              <>
                <DropdownMenuItem onSelect={onEdit}>
                  <PencilIcon aria-hidden />
                  {t("actions.edit")}
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={onArchive}>
                  <ArchiveIcon aria-hidden />
                  {t("actions.archive")}
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </Row>
  );
}

function ArchivedList({
  categories,
  canEdit,
  onRestore,
  label,
}: {
  categories: Category[];
  canEdit: boolean;
  onRestore: (category: Category) => void;
  label: (category: Category) => string;
}) {
  const t = useTranslations("app.categories");
  if (categories.length === 0) return <p className="text-[13px] text-muted-foreground">{t("archived.empty")}</p>;
  return (
    <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border bg-card/60">
      {categories.map((category) => (
        <li key={category.id} className="flex items-center gap-3 px-4 py-2.5">
          <span className="min-w-0 flex-1 truncate text-[13px]">{label(category)}</span>
          {canEdit && (
            <Button variant="ghost" size="sm" onClick={() => onRestore(category)}>
              <ArchiveRestoreIcon />
              {t("actions.restore")}
            </Button>
          )}
        </li>
      ))}
    </ul>
  );
}

function CategoryFormDialog({
  wallet,
  editing,
  onClose,
  onSaved,
}: {
  wallet: Wallet;
  editing: Editing;
  onClose: () => void;
  onSaved: () => void;
}) {
  const common = useTranslations("common");
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent closeLabel={common("close")} className="max-w-md">
        {editing && (
          <CategoryForm
            key={editing.mode === "edit" ? editing.category.id : `new-${editing.parent?.id ?? "top"}`}
            wallet={wallet}
            editing={editing}
            onCancel={onClose}
            onSaved={onSaved}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}

function CategoryForm({
  wallet,
  editing,
  onCancel,
  onSaved,
}: {
  wallet: Wallet;
  editing: NonNullable<Editing>;
  onCancel: () => void;
  onSaved: () => void;
}) {
  const t = useTranslations("app.categories");
  const colors = useTranslations("app.accounts.colors");
  const common = useTranslations("common");
  const label = useCategoryLabel();
  const request = useApi();
  const existing = editing.mode === "edit" ? editing.category : null;
  const parent = editing.mode === "create" ? editing.parent : null;
  // Subcategories take their parent's look; only top-level ones choose.
  const isChild = existing ? existing.parentId !== null : parent !== null;
  const [name, setName] = React.useState(existing?.name ?? "");
  const [icon, setIcon] = React.useState<CategoryIcon>((existing?.icon as CategoryIcon) ?? parent?.icon ?? "tag");
  const [color, setColor] = React.useState(existing?.color ?? parent?.color ?? "blue");
  const { pending, failure, run } = useWalletRequest();
  const base = `/api/wallets/${wallet.id}/categories`;

  const title = existing
    ? t("form.editTitle")
    : parent
      ? t("form.createSubTitle", { parent: label(parent) })
      : t("form.createTitle");

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (event) => {
        event.preventDefault();
        const ok = await run(() =>
          existing
            ? request("PATCH", `${base}/${existing.id}`, {
                mutationId: newId(),
                baseVersion: existing.version,
                name: name.trim() !== existing.name ? name.trim() : undefined,
                icon: !isChild && icon !== existing.icon ? icon : undefined,
                color: !isChild && color !== existing.color ? color : undefined,
              })
            : request("POST", base, {
                id: newId(),
                mutationId: newId(),
                name: name.trim(),
                kind: editing.mode === "create" ? editing.kind : "EXPENSE",
                parentId: parent?.id ?? null,
                icon,
                color,
              }),
        );
        if (ok) onSaved();
      }}
    >
      <DialogHeader>
        <DialogTitle>{title}</DialogTitle>
        <DialogDescription className="sr-only">{title}</DialogDescription>
      </DialogHeader>
      <WalletErrorMessage failure={failure} />
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="category-name">{t("form.name")}</Label>
        <Input
          id="category-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          required
          autoFocus
          maxLength={CATEGORY_NAME_MAX}
        />
      </div>
      {!isChild && (
        <>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[13px] font-medium">{t("form.icon")}</legend>
            <div className="grid grid-cols-9 gap-1.5" role="radiogroup">
              {CATEGORY_ICONS.map((value) => {
                const Icon = CATEGORY_ICON_COMPONENTS[value];
                return (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={icon === value}
                    aria-label={value}
                    onClick={() => setIcon(value)}
                    className={cn(
                      "flex size-8 items-center justify-center rounded-md text-foreground/70 outline-none transition-colors hover:bg-foreground/5 focus-visible:ring-[3px] focus-visible:ring-ring/40",
                      icon === value && "bg-primary text-primary-foreground hover:bg-primary",
                    )}
                  >
                    <Icon className="size-4" aria-hidden />
                  </button>
                );
              })}
            </div>
          </fieldset>
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[13px] font-medium">{t("form.color")}</legend>
            <div className="flex flex-wrap gap-2" role="radiogroup">
              {CATEGORY_COLORS.map((value) => (
                <button
                  key={value}
                  type="button"
                  role="radio"
                  aria-checked={color === value}
                  aria-label={colors(value)}
                  title={colors(value)}
                  onClick={() => setColor(value)}
                  className={cn(
                    "size-6 rounded-full outline-none ring-offset-2 ring-offset-card focus-visible:ring-[3px] focus-visible:ring-ring/40",
                    COLOR_BG[value],
                    color === value && "ring-2 ring-foreground/70",
                  )}
                />
              ))}
            </div>
          </fieldset>
        </>
      )}
      <DialogFooter>
        <Button type="button" variant="secondary" onClick={onCancel}>
          {t("form.cancel")}
        </Button>
        <Button type="submit" disabled={pending || !name.trim()}>
          {pending ? <Spinner label={common("loading")} /> : existing ? t("form.save") : t("form.create")}
        </Button>
      </DialogFooter>
    </form>
  );
}

function ArchiveCategoryDialog({
  wallet,
  category,
  onClose,
  onArchived,
}: {
  wallet: Wallet;
  category: Category | null;
  onClose: () => void;
  onArchived: () => void;
}) {
  const t = useTranslations("app.categories.archive");
  const common = useTranslations("common");
  const label = useCategoryLabel();
  const request = useApi();
  const { pending, failure, setFailure, run } = useWalletRequest();
  return (
    <Dialog
      open={category !== null}
      onOpenChange={(open) => {
        if (!open) {
          setFailure(null);
          onClose();
        }
      }}
    >
      <DialogContent closeLabel={common("close")} className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{t("title", { name: category ? label(category) : "" })}</DialogTitle>
          <DialogDescription>{t("body")}</DialogDescription>
        </DialogHeader>
        <WalletErrorMessage failure={failure} />
        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>
            {t("cancel")}
          </Button>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              if (!category) return;
              const ok = await run(() =>
                request("POST", `/api/wallets/${wallet.id}/categories/${category.id}/archive`, {
                  mutationId: newId(),
                  baseVersion: category.version,
                }),
              );
              if (ok) onArchived();
            }}
          >
            {pending ? <Spinner label={common("loading")} /> : t("confirm")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
