/**
 * The system categories every wallet starts with (proposal of 2026-10-25,
 * waiting for review: wiki/finfy/data-model.md). Pure data, no imports, so
 * the migration generator and the tests can read it directly.
 *
 * Each row's ID is `deterministicId("system_category", key)`, so every server
 * and device agrees on it. The label is `categories.<key>` in the message
 * files; children without an icon use their parent's. Changing this list means
 * a new migration: never edit or reuse a key that has shipped.
 */

export type SystemCategory = {
  key: string;
  kind: "INCOME" | "EXPENSE";
  parent?: string;
  /** lucide icon name (top-level only). */
  icon?: string;
  /** Color token, same set as accounts (top-level only). */
  color?: string;
};

const group = (
  key: string,
  kind: "INCOME" | "EXPENSE",
  icon: string,
  color: string,
  children: string[] = [],
): SystemCategory[] => [
  { key, kind, icon, color },
  ...children.map((child) => ({ key: `${key}_${child}`, kind, parent: key })),
];

export const SYSTEM_CATEGORIES: SystemCategory[] = [
  ...group("food", "EXPENSE", "utensils", "orange", ["groceries", "restaurants", "cafes", "delivery"]),
  ...group("housing", "EXPENSE", "house", "blue", [
    "rent",
    "condo",
    "electricity",
    "water",
    "gas",
    "internet_phone",
    "maintenance",
    "household",
  ]),
  ...group("transport", "EXPENSE", "car", "teal", [
    "fuel",
    "public",
    "ride",
    "parking_tolls",
    "vehicle_maintenance",
    "vehicle_insurance_taxes",
  ]),
  ...group("health", "EXPENSE", "heart-pulse", "red", ["pharmacy", "doctor", "dentist", "insurance", "fitness"]),
  ...group("education", "EXPENSE", "graduation-cap", "purple", ["courses", "school", "books"]),
  ...group("leisure", "EXPENSE", "party-popper", "pink", ["going_out", "culture", "hobbies"]),
  ...group("travel", "EXPENSE", "plane", "teal", ["lodging", "tickets", "tours"]),
  ...group("subscriptions", "EXPENSE", "repeat", "purple", ["streaming", "apps"]),
  ...group("shopping", "EXPENSE", "shopping-bag", "pink", ["clothing", "electronics", "gifts"]),
  ...group("personal", "EXPENSE", "sparkles", "orange", ["hair_beauty", "hygiene"]),
  ...group("pets", "EXPENSE", "paw-print", "green", ["food", "vet"]),
  ...group("family", "EXPENSE", "users", "blue", ["kids", "allowance"]),
  ...group("services", "EXPENSE", "wrench", "gray"),
  ...group("taxes_fees", "EXPENSE", "receipt", "gray", ["bank_fees", "taxes"]),
  ...group("debts", "EXPENSE", "landmark", "red", ["loans", "interest"]),
  ...group("donations", "EXPENSE", "hand-heart", "green"),
  ...group("other_expense", "EXPENSE", "ellipsis", "gray"),
  ...group("salary", "INCOME", "briefcase", "green", ["bonus"]),
  ...group("freelance", "INCOME", "laptop", "teal"),
  ...group("investment_income", "INCOME", "trending-up", "blue"),
  ...group("benefits", "INCOME", "ticket", "orange"),
  ...group("gifts_received", "INCOME", "gift", "pink"),
  ...group("cashback", "INCOME", "badge-percent", "purple"),
  ...group("other_income", "INCOME", "ellipsis", "gray"),
];
