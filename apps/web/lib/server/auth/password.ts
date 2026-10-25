import "server-only";
import { createHmac } from "node:crypto";
import { hash, verify } from "@node-rs/argon2";
import { env } from "@packages/env/server";

/**
 * Passwords (wiki/decisoes/0004): HMAC-SHA256 pepper, then Argon2id with a
 * random 16-byte salt embedded in the PHC string. Parameters are explicit so a
 * change is detected and the hash redone on the next successful login.
 */
// algorithm 2 = Argon2id (the library exports it as a const enum, unusable with isolatedModules).
const ARGON2 = { algorithm: 2, memoryCost: 65536, timeCost: 3, parallelism: 1 } as const;
const PHC_PARAMS = `m=${ARGON2.memoryCost},t=${ARGON2.timeCost},p=${ARGON2.parallelism}`;

/** Pepper versions; the highest one is used for new hashes. */
function peppers(): Map<number, string> {
  const map = new Map<number, string>();
  if (env.PASSWORD_PEPPER_V1) map.set(1, env.PASSWORD_PEPPER_V1);
  return map;
}

export function currentPepper(): { version: number; key: string } {
  const all = peppers();
  const version = Math.max(0, ...all.keys());
  const key = all.get(version);
  if (!key) throw new Error("PASSWORD_PEPPER_V1 is not set");
  return { version, key };
}

function pepper(password: string, key: string): string {
  return createHmac("sha256", key).update(password.normalize("NFKC")).digest("base64");
}

export async function hashPassword(password: string): Promise<{ hash: string; pepperVersion: number }> {
  const { version, key } = currentPepper();
  return { hash: await hash(pepper(password, key), ARGON2), pepperVersion: version };
}

export async function verifyPassword(
  stored: { hash: string; pepperVersion: number },
  password: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  const key = peppers().get(stored.pepperVersion);
  if (!key) return { ok: false, needsRehash: false };
  const ok = await verify(stored.hash, pepper(password, key));
  const needsRehash = ok && (stored.pepperVersion !== currentPepper().version || !stored.hash.includes(PHC_PARAMS));
  return { ok, needsRehash };
}

let dummyHash: Promise<string> | undefined;

/**
 * Runs a real verification against a throwaway hash, so a login for an unknown
 * e-mail takes as long as one for a real account (no enumeration by timing).
 */
export async function verifyDummyPassword(password: string): Promise<void> {
  const { key } = currentPepper();
  dummyHash ??= hash(pepper("finfy-dummy-password", key), ARGON2);
  await verify(await dummyHash, pepper(password, key));
}

/** HMAC of a short secret (OTP code) with the current pepper; never stored in clear. */
export function hmacSecret(value: string): string {
  return createHmac("sha256", currentPepper().key).update(value).digest("base64url");
}
