import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { agentConnections, agentPurchaseRequests, creditCards, users, wallets, walletMembers } from "@packages/shared/db/schema";
import { newId } from "@packages/shared/ids";
import { can } from "@packages/shared/roles";
import type { AgentPurchaseInput, AgentScope, ConnectionInput, Connections, CreatedConnection } from "@packages/shared/integrations";
import { createPurchaseInTransaction, selectCards } from "./cards";
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
  if (!connection.walletIds.includes(walletId) || !connection.scopes.includes(scope)) throw new CommandError("forbidden");
  await requireRole(tx, walletId, connection.userId, action(scope));
  return connection;
}

export function listAgentWallets(token: string) {
  return runCommand(async (tx) => {
    const connection = await authenticate(tx, token);
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
    const [wallet] = await tx.select({ currencyCode: wallets.currencyCode }).from(wallets).where(eq(wallets.id, walletId));
    if (wallet.currencyCode !== input.currencyCode) throw new CommandError("invalidInput");
    if (!purchase?.invoiceId) throw new Error("missing_agent_purchase_invoice");
    const receipt = { purchaseId, invoiceId: purchase.invoiceId };
    await tx.insert(agentPurchaseRequests).values({ connectionId: connection.id, requestId, requestHash, ...receipt });
    return receipt;
  });
}
