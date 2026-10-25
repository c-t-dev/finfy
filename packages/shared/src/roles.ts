/**
 * Wallet roles and the permission matrix from wiki/decisoes/0002. The server
 * checks these on every request against `wallet_members`; the client uses the
 * same functions only to hide what a role cannot do.
 */
export const WALLET_ROLES = ["OWNER", "ADMIN", "EDITOR", "VIEWER"] as const;
export type WalletRole = (typeof WALLET_ROLES)[number];

export type WalletAction =
  | "view"
  | "editEntries"
  | "deleteEntries"
  | "editWallet"
  | "manageMembers"
  | "manageAdmins"
  | "transferOwnership"
  | "archiveWallet"
  | "leave";

const MATRIX: Record<WalletAction, readonly WalletRole[]> = {
  view: ["OWNER", "ADMIN", "EDITOR", "VIEWER"],
  editEntries: ["OWNER", "ADMIN", "EDITOR"],
  deleteEntries: ["OWNER", "ADMIN", "EDITOR"],
  editWallet: ["OWNER", "ADMIN"],
  // Invite, remove and change the role of EDITOR and VIEWER members.
  manageMembers: ["OWNER", "ADMIN"],
  // Invite, remove and change the role of ADMIN members.
  manageAdmins: ["OWNER"],
  transferOwnership: ["OWNER"],
  archiveWallet: ["OWNER"],
  // The owner has to transfer ownership before leaving.
  leave: ["ADMIN", "EDITOR", "VIEWER"],
};

export function can(role: WalletRole, action: WalletAction): boolean {
  return MATRIX[action].includes(role);
}

const RANK: Record<WalletRole, number> = { OWNER: 3, ADMIN: 2, EDITOR: 1, VIEWER: 0 };

/**
 * Whether `actor` may set a member's role from `current` to `next`. Nobody
 * changes their own role (`isSelf`) or a role equal to or above their own, and
 * OWNER is only reached through an ownership transfer.
 */
export function canChangeRole(
  actor: WalletRole,
  current: WalletRole,
  next: WalletRole,
  isSelf: boolean,
): boolean {
  if (isSelf || next === "OWNER" || current === "OWNER") return false;
  const needed: WalletAction = current === "ADMIN" || next === "ADMIN" ? "manageAdmins" : "manageMembers";
  return can(actor, needed) && RANK[current] < RANK[actor] && RANK[next] < RANK[actor];
}
