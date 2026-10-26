import assert from "node:assert/strict";
import { test } from "node:test";
import { createAssetInput, updateAssetInput } from "@packages/shared/patrimony";
import { deterministicId, newId } from "@packages/shared/ids";

test("association payload distinguishes omitted links, replacement and explicit removal", () => {
  const mutationId = newId(), id = newId();
  assert.deepEqual(updateAssetInput.parse({ mutationId, baseVersion: 1, linkedIds: [] }).linkedIds, []);
  assert.deepEqual(updateAssetInput.parse({ mutationId, baseVersion: 1, linkedIds: [id] }).linkedIds, [id]);
  assert.equal(updateAssetInput.parse({ mutationId, baseVersion: 1, name: "Car" }).linkedIds, undefined);
  assert.equal(updateAssetInput.safeParse({ mutationId, baseVersion: 1, linkedIds: [id, id] }).success, false);
  assert.equal(updateAssetInput.safeParse({ mutationId, baseVersion: 1, linkedIds: ["invalid"] }).success, false);
  assert.equal(updateAssetInput.safeParse({ mutationId, baseVersion: 1 }).success, false);
  assert.equal(createAssetInput.safeParse({ id: newId(), mutationId, kind: "ASSET", type: "VEHICLE", name: "Car", currentValueMinor: 100, purchaseValueMinor: null, purchaseDate: null, ownershipBps: 10000, notes: null, linkedIds: [id] }).success, true);
  assert.equal(deterministicId("asset_liabilities", id, mutationId), deterministicId("asset_liabilities", id, mutationId));
});
