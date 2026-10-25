import { sql } from "drizzle-orm";
import {
  bigint,
  boolean,
  char,
  check,
  index,
  inet,
  integer,
  jsonb,
  pgTable,
  smallint,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { LOCALES } from "../../i18n/locales";
import { createdAt, enumCheck, idColumn, textEnum, timestamptz, updatedAt } from "../columns";

/**
 * Identity and security (wiki/decisoes/0004-seguranca-da-conta.md). None of
 * these tables is synced or added to the `powersync` publication, except
 * `currencies`, which is reference data.
 */

export const currencies = pgTable("currencies", {
  code: char("code", { length: 3 }).primaryKey(),
  name: text("name").notNull(),
  symbol: text("symbol").notNull(),
  minorUnits: smallint("minor_units").notNull(),
  isEnabled: boolean("is_enabled").notNull().default(true),
});

export const users = pgTable(
  "users",
  {
    id: idColumn(),
    name: text("name").notNull(),
    /** Always stored lowercased. */
    email: text("email").notNull(),
    emailVerifiedAt: timestamptz("email_verified_at"),
    language: textEnum("language", LOCALES).notNull().default("en"),
    preferredCurrencyCode: char("preferred_currency_code", { length: 3 }).references(() => currencies.code),
    mfaEnabledAt: timestamptz("mfa_enabled_at"),
    failedLoginCount: integer("failed_login_count").notNull().default(0),
    lockedUntil: timestamptz("locked_until"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    /** Set on account erasure, together with pseudonymization. */
    deletedAt: timestamptz("deleted_at"),
  },
  (t) => [
    uniqueIndex("users_email_unique").on(t.email),
    check("users_email_lowercase_check", sql`${t.email} = lower(${t.email})`),
    enumCheck("users_language_check", t.language, LOCALES),
  ],
);

/** Argon2id in PHC format (salt embedded); HMAC-SHA256 pepper applied before hashing. */
export const userCredentials = pgTable("user_credentials", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  passwordHash: text("password_hash").notNull(),
  pepperVersion: smallint("pepper_version").notNull(),
  passwordChangedAt: timestamptz("password_changed_at").notNull().defaultNow(),
});

export const OAUTH_PROVIDERS = ["GOOGLE", "APPLE"] as const;

/** Provider tokens are never stored. */
export const userOauthProviders = pgTable(
  "user_oauth_providers",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    provider: textEnum("provider", OAUTH_PROVIDERS).notNull(),
    providerUserId: text("provider_user_id").notNull(),
    email: text("email"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("user_oauth_providers_provider_user_unique").on(t.provider, t.providerUserId),
    enumCheck("user_oauth_providers_provider_check", t.provider, OAUTH_PROVIDERS),
  ],
);

/** TOTP secret encrypted with AES-256-GCM; the key lives outside the database. */
export const userMfaTotp = pgTable("user_mfa_totp", {
  userId: uuid("user_id")
    .primaryKey()
    .references(() => users.id),
  secretEncrypted: text("secret_encrypted").notNull(),
  keyVersion: smallint("key_version").notNull(),
  confirmedAt: timestamptz("confirmed_at"),
  /** Last accepted 30 s step, so a code cannot be replayed. */
  lastUsedStep: bigint("last_used_step", { mode: "number" }),
});

/** 10 codes per generation; only hashes are stored. */
export const userRecoveryCodes = pgTable(
  "user_recovery_codes",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    codeHash: text("code_hash").notNull(),
    usedAt: timestamptz("used_at"),
    createdAt: createdAt(),
  },
  (t) => [index("user_recovery_codes_user_idx").on(t.userId)],
);

export const OTP_PURPOSES = ["EMAIL_VERIFY", "LOGIN", "STEP_UP", "MFA_FALLBACK"] as const;

/** E-mailed one-time codes: 10 minutes, 5 attempts. */
export const otpCodes = pgTable(
  "otp_codes",
  {
    id: idColumn(),
    userId: uuid("user_id").references(() => users.id),
    email: text("email").notNull(),
    purpose: textEnum("purpose", OTP_PURPOSES).notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    attempts: smallint("attempts").notNull().default(0),
    usedAt: timestamptz("used_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("otp_codes_email_purpose_idx").on(t.email, t.purpose),
    enumCheck("otp_codes_purpose_check", t.purpose, OTP_PURPOSES),
  ],
);

export const DEVICE_PLATFORMS = ["WINDOWS", "MACOS", "ANDROID", "IOS", "WEB"] as const;

/** Web sessions also get a device row, without sync. */
export const devices = pgTable(
  "devices",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    platform: textEnum("platform", DEVICE_PLATFORMS).notNull(),
    schemaVersion: integer("schema_version"),
    lastSyncAt: timestamptz("last_sync_at"),
    revokedAt: timestamptz("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("devices_user_idx").on(t.userId),
    enumCheck("devices_platform_check", t.platform, DEVICE_PLATFORMS),
  ],
);

/** Opaque session token; only its SHA-256 is stored. */
export const userSessions = pgTable(
  "user_sessions",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    deviceId: uuid("device_id").references(() => devices.id),
    tokenHash: text("token_hash").notNull(),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    lastSeenAt: timestamptz("last_seen_at").notNull().defaultNow(),
    idleExpiresAt: timestamptz("idle_expires_at").notNull(),
    absoluteExpiresAt: timestamptz("absolute_expires_at").notNull(),
    stepUpUntil: timestamptz("step_up_until"),
    revokedAt: timestamptz("revoked_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("user_sessions_token_hash_unique").on(t.tokenHash), index("user_sessions_user_idx").on(t.userId)],
);

/** 30 minutes, single use. */
export const passwordResetTokens = pgTable(
  "password_reset_tokens",
  {
    id: idColumn(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    tokenHash: text("token_hash").notNull(),
    expiresAt: timestamptz("expires_at").notNull(),
    usedAt: timestamptz("used_at"),
    createdAt: createdAt(),
  },
  (t) => [uniqueIndex("password_reset_tokens_token_hash_unique").on(t.tokenHash)],
);

/**
 * Fixed-window counters against brute force (per IP, per e-mail), kept in
 * Postgres because functions on Vercel share no memory. One row per key,
 * reset in place when its window expires; a cleanup job can delete stale keys.
 */
export const rateLimits = pgTable("rate_limits", {
  key: text("key").primaryKey(),
  windowStartedAt: timestamptz("window_started_at").notNull(),
  count: integer("count").notNull(),
});

/** Account-level events (logins, MFA, password changes), separate from `audit_logs`. */
export const securityEvents = pgTable(
  "security_events",
  {
    id: idColumn(),
    userId: uuid("user_id").references(() => users.id),
    type: text("type").notNull(),
    ip: inet("ip"),
    userAgent: text("user_agent"),
    metadata: jsonb("metadata").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [index("security_events_user_created_idx").on(t.userId, t.createdAt)],
);
