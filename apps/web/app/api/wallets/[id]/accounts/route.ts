import { createAccountInput } from "@packages/shared/accounts";
import { createAccount, listAccounts } from "@/lib/server/accounts";
import { requireActor, walletRead, walletWrite } from "@/lib/server/wallet-route";

export const dynamic = "force-dynamic";

/** Accounts of the wallet with their balance; `?archived=1` lists the archived ones. */
export async function GET(request: Request, ctx: RouteContext<"/api/wallets/[id]/accounts">) {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  const { id } = await ctx.params;
  const archived = new URL(request.url).searchParams.get("archived") === "1";
  return walletRead(await listAccounts(actor.userId, id, archived), (accounts) => ({ accounts }));
}

/** Creates an account (OWNER, ADMIN, EDITOR). */
export async function POST(request: Request, ctx: RouteContext<"/api/wallets/[id]/accounts">) {
  const { id } = await ctx.params;
  return walletWrite(request, createAccountInput, (actor, input) => createAccount(actor, id, input), 201);
}
