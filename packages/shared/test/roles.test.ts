import assert from "node:assert/strict";
import test from "node:test";
import { can, createWalletAbility, WALLET_ROLES, type WalletAction } from "../src/roles.ts";

test("CASL preserves every role/action permission in decision 0002", () => {
  const expected: Record<WalletAction, readonly string[]> = {
    view: ["OWNER", "ADMIN", "EDITOR", "VIEWER"],
    editEntries: ["OWNER", "ADMIN", "EDITOR"],
    deleteEntries: ["OWNER", "ADMIN", "EDITOR"],
    editWallet: ["OWNER", "ADMIN"],
    manageMembers: ["OWNER", "ADMIN"],
    manageAdmins: ["OWNER"],
    transferOwnership: ["OWNER"],
    archiveWallet: ["OWNER"],
    leave: ["ADMIN", "EDITOR", "VIEWER"],
  };
  for (const role of WALLET_ROLES) {
    const ability = createWalletAbility(role);
    for (const [action, roles] of Object.entries(expected)) {
      assert.equal(can(role, action as WalletAction), roles.includes(role), `${role}: ${action}`);
      assert.equal(ability.can(action as WalletAction, "Wallet"), roles.includes(role));
    }
    assert.equal(can(role, "unknownAction" as WalletAction), false);
  }
});

test("a caller cannot change shared authorization by updating a returned ability", () => {
  const ability = createWalletAbility("VIEWER");
  ability.update([{ action: "archiveWallet", subject: "Wallet" }]);
  assert.equal(can("VIEWER", "archiveWallet"), false);
  assert.equal(createWalletAbility("VIEWER").can("archiveWallet", "Wallet"), false);
});
