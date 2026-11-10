import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { accounts, agentConnections, agentEntryRequests, agentPurchaseRequests, creditCards, tags, users, wallets, walletMembers } from "@packages/shared/db/schema";
import { newId } from "@packages/shared/ids";
import { can } from "@packages/shared/roles";
import type { AgentEntryInput, AgentEntryReceipt, AgentPurchaseInput, AgentScope, ConnectionInput, Connections, CreatedConnection } from "@packages/shared/integrations";
import { createPurchaseInTransaction, selectCards } from "./cards";
import { createTransferInput } from "@packages/shared/transactions";
import { createRecurrenceInput } from "@packages/shared/recurrences";
import { createEntryInTransaction, createTransferInTransaction } from "./entries";
import { createRecurrenceInTransaction } from "./recurrences";
import { activeCategories } from "./categories";
import { CommandError, requireRole, runCommand } from "./commands";
import type { Tx } from "./write";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const action = (scope: AgentScope) => scope === "invoices:read" ? "view" : "editEntries";
const activeCards = (walletId: string) => and(eq(creditCards.walletId, walletId), isNull(creditCards.archivedAt));

function summary(row: typeof agentConnections.$inferSelect) {
  return { id: row.id, name: row.name, walletIds: row.walletIds, scopes: row.scopes, revoked: row.revokedAt !== null };
}

async function accountPlan(tx: Tx, userId: string) {
  const [row] = await tx.select({ plan: users.plan }).from(users)
    .where(and(eq(users.id, userId), isNull(users.deletedAt))).for("share");
  if (!row) throw new CommandError("unauthenticated");
  return row.plan;
}

export function listConnections(userId: string) {
  return runCommand<Connections>(async (tx) => ({
    plan: await accountPlan(tx, userId),
    connections: (await tx.select().from(agentConnections).where(eq(agentConnections.userId, userId))
      .orderBy(asc(agentConnections.createdAt))).map(summary),
  }));
}

export function createConnection(userId: string, input: ConnectionInput) {
  return runCommand<CreatedConnection>(async (tx) => {
    if (await accountPlan(tx, userId) !== "PAID") throw new CommandError("forbidden");
    const walletIds = [...new Set(input.walletIds.map(id => id.toLowerCase()))];
    const scopes = [...new Set(input.scopes)];

    for (const walletId of walletIds) {
      for (const scope of scopes) await requireRole(tx, walletId, userId, action(scope));
    }
    const token = "finfy_agent_" + randomBytes(32).toString("base64url");
    const [row] = await tx.insert(agentConnections).values({
      id: newId(), userId, name: input.name, walletIds, scopes, tokenHash: hash(token),
    }).returning();
    return { ...summary(row), token };
  });
}

export function revokeConnection(userId: string, id: string) {
  return runCommand(async (tx) => {
    await tx.update(agentConnections).set({ revokedAt: new Date() })
      .where(and(eq(agentConnections.id, id), eq(agentConnections.userId, userId), isNull(agentConnections.revokedAt)));
    return null;
  });
}

async function authenticate(tx: Tx, token: string, writing = false) {
  const [connection] = await tx.select().from(agentConnections)
    .where(and(eq(agentConnections.tokenHash, hash(token)), isNull(agentConnections.revokedAt)))
    .for(writing ? "no key update" : "share");
  if (!connection) throw new CommandError("unauthenticated");
  if (await accountPlan(tx, connection.userId) !== "PAID") throw new CommandError("forbidden");
  return connection;
}

async function authorize(tx: Tx, token: string, walletId: string, scope: AgentScope, writing = false) {
  const connection = await authenticate(tx, token, writing);
  if (!connection.walletIds.includes(walletId) || !connection.scopes.includes("invoices:read") || !connection.scopes.includes(scope)) {
    throw new CommandError("forbidden");
  }
  await requireRole(tx, walletId, connection.userId, action(scope));
  return connection;
}

export function listAgentWallets(token: string) {
  return runCommand(async (tx) => {
    const connection = await authenticate(tx, token);
    if (!connection.scopes.includes("invoices:read")) return [];
    const rows = await tx.select({ id: wallets.id, name: wallets.name, currencyCode: wallets.currencyCode, role: walletMembers.role })
      .from(walletMembers).innerJoin(wallets, eq(wallets.id, walletMembers.walletId))
      .where(and(inArray(wallets.id, connection.walletIds), eq(walletMembers.userId, connection.userId),
        isNull(walletMembers.removedAt), isNull(wallets.archivedAt)));
    return rows.flatMap(({ role, ...wallet }) => {
      const scopes = connection.scopes.filter(scope => can(role, action(scope)));
      return scopes.length ? [{ ...wallet, scopes }] : [];
    });
  });
}

export function listAgentInvoices(token: string, walletId: string) {
  return runCommand(async (tx) => {
    await authorize(tx, token, walletId, "invoices:read");
    const cards = await selectCards(tx, activeCards(walletId));
    return cards.map(({ id, name, nextInvoice }) => ({
      cardId: id, cardName: name,
      nextInvoice: nextInvoice && { dueDate: nextInvoice.dueDate, totalMinor: nextInvoice.totalMinor },
    }));
  });
}

export function listAgentTargets(token: string, walletId: string) {
  return runCommand(async (tx) => {
    await authorize(tx, token, walletId, "purchases:create");
    const cards = await tx.select({ id: creditCards.id, name: creditCards.name }).from(creditCards).where(activeCards(walletId));
    const categories = (await activeCategories(tx, walletId))
      .filter(category => category.kind !== "INCOME" && !category.hidden)
      .map(({ id, name, parentId }) => ({ id, name, parentId }));
    return { cards, categories };
  });
}

async function requireCurrency(tx: Tx, walletId: string, currencyCode: string) {
  const [wallet] = await tx.select({ currencyCode: wallets.currencyCode }).from(wallets).where(eq(wallets.id, walletId));
  if (wallet?.currencyCode !== currencyCode) throw new CommandError("invalidInput");
}

export function recordAgentPurchase(token: string, walletId: string, cardId: string, input: AgentPurchaseInput) {
  return runCommand(async (tx) => {
    // The connection lock serializes retries through receipt and purchase commit.
    const connection = await authorize(tx, token, walletId, "purchases:create", true);
    const requestId = input.requestId.toLowerCase();
    const categoryId = input.categoryId.toLowerCase();
    const requestHash = hash(JSON.stringify([
      walletId, cardId, categoryId, input.description, input.amountMinor, input.transactionDate, input.currencyCode,
    ]));
    const [prior] = await tx.select().from(agentPurchaseRequests)
      .where(and(eq(agentPurchaseRequests.connectionId, connection.id), eq(agentPurchaseRequests.requestId, requestId)));
    if (prior) {
      if (prior.requestHash !== requestHash) throw new CommandError("versionConflict");
      return { purchaseId: prior.purchaseId, invoiceId: prior.invoiceId };
    }

    const purchaseId = newId();
    const [purchase] = await createPurchaseInTransaction(tx, { userId: connection.userId, deviceId: null },
      walletId, cardId, { ...input, categoryId, id: purchaseId, mutationId: newId(), installments: 1 }, connection.id);
    await requireCurrency(tx, walletId, input.currencyCode);
    if (!purchase?.invoiceId) throw new Error("missing_agent_purchase_invoice");
    const receipt = { purchaseId, invoiceId: purchase.invoiceId };
    await tx.insert(agentPurchaseRequests).values({ connectionId: connection.id, requestId, requestHash, ...receipt });
    return receipt;
  });
}

export function listAgentEntryTargets(token: string, walletId: string) {
  return runCommand(async (tx) => {
    await authorize(tx, token, walletId, "entries:create");
    const [availableAccounts, cards, categories, availableTags] = await Promise.all([
      tx.select({ id: accounts.id, name: accounts.name }).from(accounts)
        .where(and(eq(accounts.walletId, walletId), isNull(accounts.archivedAt))),
      tx.select({ id: creditCards.id, name: creditCards.name }).from(creditCards).where(activeCards(walletId)),
      activeCategories(tx, walletId),
      tx.select({ id: tags.id, name: tags.name }).from(tags)
        .where(and(eq(tags.walletId, walletId), isNull(tags.archivedAt))),
    ]);
    return {
      accounts: availableAccounts,
      cards,
      categories: categories.filter(category => !category.hidden).map(({ id, name, parentId, kind }) => ({ id, name, parentId, kind })),
      tags: availableTags,
    };
  });
}

async function createAgentEntries(
  tx: Tx,
  actor: { userId: string; deviceId: null },
  connectionId: string,
  walletId: string,
  input: AgentEntryInput,
): Promise<string[]> {
  const identifiers = { id: newId(), mutationId: newId() };
  switch (input.kind) {
    case "entry": {
      const entry = await createEntryInTransaction(tx, actor, walletId, { ...input, ...identifiers }, connectionId);
      return [entry.id];
    }
    case "transfer": {
      const transfer = createTransferInput.safeParse({
        ...input, ...identifiers, inId: newId(),
        fromAccountId: input.fromAccountId.toLowerCase(), toAccountId: input.toAccountId.toLowerCase(),
      });
      if (!transfer.success) throw new CommandError("invalidInput");
      await createTransferInTransaction(tx, actor, walletId, transfer.data, connectionId);
      return [transfer.data.id, transfer.data.inId];
    }
    case "purchase": {
      const entries = await createPurchaseInTransaction(tx, actor, walletId, input.cardId,
        { ...input, ...identifiers }, connectionId);
      return entries.map(entry => entry.id);
    }
    case "recurrence": {
      const recurrence = createRecurrenceInput.safeParse({ ...input, ...identifiers });
      if (!recurrence.success) throw new CommandError("invalidInput");
      const schedule = await createRecurrenceInTransaction(tx, actor, walletId, recurrence.data, connectionId);
      return [schedule.id];
    }
  }
}

export function recordAgentEntry(token: string, walletId: string, input: AgentEntryInput) {
  return runCommand<AgentEntryReceipt>(async (tx) => {
    const connection = await authorize(tx, token, walletId, "entries:create", true);
    const { requestId: suppliedId, ...payload } = input;
    const requestId = suppliedId.toLowerCase();
    const requestHash = hash(JSON.stringify([walletId, payload]));
    const [prior] = await tx.select().from(agentEntryRequests)
      .where(and(eq(agentEntryRequests.connectionId, connection.id), eq(agentEntryRequests.requestId, requestId)));
    if (prior) {
      if (prior.requestHash !== requestHash) throw new CommandError("versionConflict");
      return prior.receipt;
    }

    await requireCurrency(tx, walletId, input.currencyCode);
    const ids = await createAgentEntries(tx, { userId: connection.userId, deviceId: null }, connection.id, walletId, input);
    // The normal commands lock the wallet currency. Recheck after that lock to reject a concurrent currency change.
    await requireCurrency(tx, walletId, input.currencyCode);
    const receipt = { kind: input.kind, ids };
    await tx.insert(agentEntryRequests).values({ connectionId: connection.id, requestId, requestHash, receipt });
    return receipt;
  });
}
