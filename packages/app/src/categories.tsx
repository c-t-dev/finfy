"use client";

import * as React from "react";
import {
  BadgePercentIcon,
  BabyIcon,
  BookOpenIcon,
  BriefcaseIcon,
  BusIcon,
  CarIcon,
  CoffeeIcon,
  DumbbellIcon,
  EllipsisIcon,
  FuelIcon,
  Gamepad2Icon,
  GiftIcon,
  GraduationCapIcon,
  HandHeartIcon,
  HeartPulseIcon,
  HouseIcon,
  LandmarkIcon,
  LaptopIcon,
  MusicIcon,
  PartyPopperIcon,
  PawPrintIcon,
  PiggyBankIcon,
  PlaneIcon,
  ReceiptIcon,
  RepeatIcon,
  ShirtIcon,
  ShoppingBagIcon,
  SmartphoneIcon,
  SparklesIcon,
  TagIcon,
  TicketIcon,
  TrendingUpIcon,
  UsersIcon,
  UtensilsIcon,
  WalletIcon,
  WrenchIcon,
  type LucideIcon,
} from "lucide-react";
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from "@packages/ui/components/select";
import { cn } from "@packages/ui/lib/utils";
import type { Category, CategoryIcon as CategoryIconName } from "@packages/shared/categories";
import { useResource } from "./api";
import { useTranslations } from "./i18n";

export const CATEGORY_ICON_COMPONENTS: Record<CategoryIconName, LucideIcon> = {
  utensils: UtensilsIcon,
  coffee: CoffeeIcon,
  house: HouseIcon,
  car: CarIcon,
  fuel: FuelIcon,
  bus: BusIcon,
  plane: PlaneIcon,
  "heart-pulse": HeartPulseIcon,
  dumbbell: DumbbellIcon,
  "graduation-cap": GraduationCapIcon,
  "book-open": BookOpenIcon,
  "party-popper": PartyPopperIcon,
  music: MusicIcon,
  "gamepad-2": Gamepad2Icon,
  repeat: RepeatIcon,
  "shopping-bag": ShoppingBagIcon,
  shirt: ShirtIcon,
  smartphone: SmartphoneIcon,
  sparkles: SparklesIcon,
  "paw-print": PawPrintIcon,
  baby: BabyIcon,
  users: UsersIcon,
  wrench: WrenchIcon,
  receipt: ReceiptIcon,
  landmark: LandmarkIcon,
  "hand-heart": HandHeartIcon,
  gift: GiftIcon,
  briefcase: BriefcaseIcon,
  laptop: LaptopIcon,
  "trending-up": TrendingUpIcon,
  ticket: TicketIcon,
  "badge-percent": BadgePercentIcon,
  "piggy-bank": PiggyBankIcon,
  wallet: WalletIcon,
  tag: TagIcon,
  ellipsis: EllipsisIcon,
};

/** Apple system colors for the color tokens (wiki/decisoes/0008). */
export const COLOR_BG: Record<string, string> = {
  blue: "bg-[#007aff]",
  green: "bg-[#34c759]",
  orange: "bg-[#ff9500]",
  red: "bg-[#ff3b30]",
  purple: "bg-[#af52de]",
  pink: "bg-[#ff2d55]",
  teal: "bg-[#30b0c7]",
  gray: "bg-[#8e8e93]",
};

/** Round colored badge with the category's icon; children use their parent's look. */
export function CategoryBadge({
  category,
  parent,
  className,
}: {
  category: Pick<Category, "icon" | "color"> | null;
  parent?: Pick<Category, "icon" | "color"> | null;
  className?: string;
}) {
  // A subcategory always shows its parent's icon and color.
  const look = parent ?? category;
  const icon = (look?.icon ?? "tag") as CategoryIconName;
  const color = look?.color ?? "gray";
  const Icon = CATEGORY_ICON_COMPONENTS[icon] ?? TagIcon;
  return (
    <span
      className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-white", COLOR_BG[color] ?? COLOR_BG.gray, className)}
      aria-hidden
    >
      <Icon className="size-3.5" />
    </span>
  );
}

/** Translated name of a category: system ones by key, the wallet's by name. */
export function useCategoryLabel(): (category: Pick<Category, "name" | "translationKey">) => string {
  const t = useTranslations("categories");
  return React.useCallback(
    (category) =>
      category.translationKey ? t(category.translationKey as Parameters<typeof t>[0]) : (category.name ?? ""),
    [t],
  );
}

export interface CategoryTree {
  all: Category[];
  byId: Map<string, Category>;
  /** Top-level categories of a kind, each with its children, sorted by label. */
  groups(kind: "INCOME" | "EXPENSE", options?: { includeHidden?: boolean }): { parent: Category; children: Category[] }[];
}

/** The wallet's categories (active), arranged as a two-level tree. */
export function useCategories(walletId: string | null) {
  const { state, reload } = useResource<{ categories: Category[] }>(walletId ? `/api/wallets/${walletId}/categories` : null);
  const label = useCategoryLabel();
  const tree = React.useMemo<CategoryTree | null>(() => {
    if (state.status !== "ready") return null;
    const all = state.value.categories;
    const byId = new Map(all.map((category) => [category.id, category]));
    const sort = (list: Category[]) => [...list].sort((a, b) => label(a).localeCompare(label(b)));
    return {
      all,
      byId,
      groups(kind, options) {
        const visible = (category: Category) =>
          (category.kind === kind || category.kind === "BOTH") && (options?.includeHidden || !category.hidden);
        return sort(all.filter((category) => !category.parentId && visible(category))).map((parent) => ({
          parent,
          children: sort(all.filter((category) => category.parentId === parent.id && visible(category))),
        }));
      },
    };
  }, [state, label]);
  return { state, tree, reload };
}

/** Category select for a transaction: groups by parent, hides hidden system categories. */
export function CategoryPicker({
  id,
  tree,
  kind,
  value,
  onValueChange,
  disabled,
}: {
  id: string;
  tree: CategoryTree | null;
  kind: "INCOME" | "EXPENSE";
  value: string | null;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("app.categories");
  const label = useCategoryLabel();
  const groups = tree?.groups(kind) ?? [];
  const selected = value ? tree?.byId.get(value) : undefined;
  const selectedParent = selected?.parentId ? tree?.byId.get(selected.parentId) : undefined;
  return (
    <Select value={value ?? undefined} onValueChange={onValueChange} disabled={disabled || !tree}>
      <SelectTrigger id={id}>
        <SelectValue placeholder={t("pick")}>
          {selected && (
            <span className="flex items-center gap-2">
              <CategoryBadge category={selected} parent={selectedParent} className="size-5" />
              {selectedParent ? `${label(selectedParent)} › ${label(selected)}` : label(selected)}
            </span>
          )}
        </SelectValue>
      </SelectTrigger>
      <SelectContent className="max-h-80">
        {groups.map(({ parent, children }) => (
          <SelectGroup key={parent.id}>
            <SelectLabel className="sr-only">{label(parent)}</SelectLabel>
            <SelectItem value={parent.id}>
              <span className="flex items-center gap-2">
                <CategoryBadge category={parent} className="size-5" />
                {label(parent)}
              </span>
            </SelectItem>
            {children.map((child) => (
              <SelectItem key={child.id} value={child.id} className="pl-9">
                {label(child)}
              </SelectItem>
            ))}
          </SelectGroup>
        ))}
      </SelectContent>
    </Select>
  );
}
