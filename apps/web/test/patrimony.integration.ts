import assert from "node:assert/strict";
import { test } from "node:test";
import { readFile, readdir } from "node:fs/promises";
import postgres from "postgres";
import { newId } from "@packages/shared/ids";
import type { Asset } from "@packages/shared/patrimony";

// Explicit opt-in; only the disposable database below is migrated or written.
test("patrimony associations: permissions, tenancy, retry, concurrency, archive and net worth", { skip: process.env.FINFY_TEST_LOCAL_POSTGRES !== "1" }, async () => {
  const database = "finfy_test_patrimony_" + Date.now();
  const admin = postgres("postgres://finfy:finfy@127.0.0.1:5432/postgres", { max: 1 });
  let db: ReturnType<typeof postgres> | undefined;
  let closeApp: (() => Promise<void>) | undefined;
  try {
    await admin.unsafe('CREATE DATABASE "' + database + '"');
    const url = "postgres://finfy:finfy@127.0.0.1:5432/" + database;
    process.env.DATABASE_URL = url;
    db = postgres(url, { max: 1, onnotice: () => {} });
    const migrations = new URL("../../../packages/shared/drizzle/", import.meta.url);
    for (const file of (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort()) {
      await db.unsafe(await readFile(new URL(file, migrations), "utf8"));
    }
    const commands = await import("../lib/server/patrimony");
    const { getDb } = await import("../lib/server/db");
    closeApp = async () => { await getDb().$client.end(); };
    const user = newId(), viewer = newId(), outsider = newId(), wallet = newId(), otherWallet = newId();
    for (const [id, email] of [[user, "owner@example.invalid"], [viewer, "viewer@example.invalid"], [outsider, "outsider@example.invalid"]]) {
      await db`insert into users (id,name,email) values (${id}, 'Synthetic test', ${email})`;
    }
    for (const id of [wallet, otherWallet]) {
      await db`insert into wallets (id,name,currency_code,created_by,updated_by) values (${id}, '[TESTE] Wallet', 'EUR', ${user}, ${user})`;
      await db`insert into wallet_members (id,wallet_id,user_id,role,created_by,updated_by) values (${newId()}, ${id}, ${user}, 'OWNER', ${user}, ${user})`;
    }
    await db`insert into wallet_members (id,wallet_id,user_id,role,created_by,updated_by) values (${newId()}, ${wallet}, ${viewer}, 'VIEWER', ${user}, ${user})`;
    const actor = { userId: user, deviceId: null };
    function value<T>(result: { ok: true; value: T } | { ok: false; error: string }): T { if (!result.ok) assert.fail(result.error); return result.value; }
    const create = async (kind: "ASSET" | "LIABILITY", amount: number, walletId = wallet, linkedIds: string[] = []) => value(await commands.createAsset(actor, walletId, { id: newId(), mutationId: newId(), kind, type: kind === "ASSET" ? "VEHICLE" : "FINANCING", name: "[TESTE] " + kind, currentValueMinor: amount, purchaseValueMinor: null, purchaseDate: null, ownershipBps: 10000, notes: null, linkedIds }));
    const car = await create("ASSET", 3000000), debt = await create("LIABILITY", 2000000);
    const foreignDebt = await create("LIABILITY", 100, otherWallet);
    const patch = (asset: Asset, linkedIds: string[], userId = user, mutationId = newId()) => commands.updateAsset({ userId, deviceId: null }, wallet, asset.id, { mutationId, baseVersion: asset.version, linkedIds });
    assert.deepEqual(await patch(car, [debt.id], viewer), { ok: false, error: "forbidden", retryAfterSeconds: undefined });
    assert.deepEqual(await patch(car, [debt.id], outsider), { ok: false, error: "notFound", retryAfterSeconds: undefined });
    assert.deepEqual(await patch(car, [foreignDebt.id]), { ok: false, error: "notFound", retryAfterSeconds: undefined });
    assert.deepEqual(await patch(car, [car.id]), { ok: false, error: "invalidInput", retryAfterSeconds: undefined });
    const mutationId = newId();
    const linked = value(await patch(car, [debt.id], user, mutationId));
    assert.deepEqual(linked.linkedIds, [debt.id]);
    assert.equal(linked.linkedAssets[0].currentValueMinor, 2000000);
    const auditCount = async () => Number((await db!`select count(*) as n from audit_logs`)[0].n);
    const count = await auditCount();
    assert.deepEqual(value(await patch(car, [debt.id], user, mutationId)).linkedIds, [debt.id]);
    assert.equal(await auditCount(), count);
    assert.deepEqual(await patch(debt, []), { ok: false, error: "versionConflict", retryAfterSeconds: undefined });
    assert.equal(value(await commands.netWorth(user, wallet)).netWorthMinor, 1000000);
    const second = await create("ASSET", 100000, wallet, [debt.id]);
    const latest = value(await commands.listAssets(user, wallet, false));
    const shared = latest.find((row) => row.id === debt.id)!;
    assert.equal(shared.linkedIds.length, 2);
    const unlinked = value(await patch(shared, [second.id]));
    assert.deepEqual(unlinked.linkedIds, [second.id]);
    const restored = value(await patch(unlinked, [car.id, second.id]));
    assert.equal(restored.linkedIds.length, 2);
    assert.equal(Number((await db`select count(*) as n from asset_liabilities`)[0].n), 2);
    const latestCar = value(await commands.listAssets(user, wallet, false)).find((row) => row.id === car.id)!;
    value(await commands.setAssetArchived(actor, wallet, car.id, true, { mutationId: newId(), baseVersion: latestCar.version }));
    const archivedPeer = value(await commands.listAssets(user, wallet, false)).find((row) => row.id === debt.id)!;
    assert.equal(archivedPeer.linkedAssets.find((row) => row.id === car.id)?.archived, true);
    assert.equal(value(await commands.netWorth(user, wallet)).netWorthMinor, -1900000);
    value(await patch(archivedPeer, [second.id]));
    const concurrentCar = await create("ASSET", 500), concurrentDebt = await create("LIABILITY", 200);
    const outcomes = await Promise.all([patch(concurrentCar, [concurrentDebt.id]), patch(concurrentDebt, [concurrentCar.id])]);
    assert.equal(outcomes.filter((result) => result.ok).length, 1);
    assert.equal(outcomes.filter((result) => !result.ok && result.error === "versionConflict").length, 1);
    const { auditHash } = await import("../lib/server/write");
    const chain = await db`select * from audit_logs where wallet_id = ${wallet} order by recorded_at, id`;
    let previousHash: string | null = null;
    for (const row of chain) {
      assert.equal(row.prev_hash, previousHash);
      const entry = { id: row.id, walletId: row.wallet_id, actorUserId: row.actor_user_id, deviceId: row.device_id, source: row.source, sourceRefId: row.source_ref_id, action: row.action, entity: row.entity, entityId: row.entity_id, changes: row.changes, occurredAt: row.occurred_at, recordedAt: row.recorded_at, mutationId: row.mutation_id, correlationId: row.correlation_id };
      assert.equal(row.hash, auditHash(previousHash, entry));
      previousHash = row.hash;
    }
    const logs = await db`select * from audit_logs where entity = 'asset_liabilities'`;
    assert.ok(logs.some((row) => row.action === "CREATE"));
    assert.ok(logs.some((row) => row.action === "ARCHIVE"));
    assert.ok(logs.some((row) => row.action === "RESTORE"));
  } finally {
    await closeApp?.();
    await db?.end();
    await admin.unsafe('DROP DATABASE IF EXISTS "' + database + '"');
    await admin.end();
  }
});
