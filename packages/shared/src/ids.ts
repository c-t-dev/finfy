import { v5 as uuidv5, v7 as uuidv7 } from "uuid";

/**
 * IDs are generated on the client, on the web too, so a write can be retried
 * and synced without the server assigning anything (wiki/finfy/data-model.md).
 */
export function newId(): string {
  return uuidv7();
}

/** Fixed namespace for deterministic IDs. Never change it: existing rows depend on it. */
const FINFY_NAMESPACE = "8f6b3f4e-2a0c-5d1e-9b7a-4c3d2e1f0a9b";

/**
 * Deterministic UUIDv5 for rows two offline devices may create independently,
 * e.g. a recurrence occurrence (`recurrence_id` + date) or a link row
 * (`transaction_id` + `tag_id`). Both devices get the same ID, so the server
 * never stores a duplicate.
 */
export function deterministicId(kind: string, ...parts: string[]): string {
  return uuidv5([kind, ...parts].join(":"), FINFY_NAMESPACE);
}
