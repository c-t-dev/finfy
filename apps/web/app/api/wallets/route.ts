import { createWalletInput } from "@packages/shared/wallets";
import { walletWrite, requireActor } from "@/lib/server/wallet-route";
import { createWallet, listWallets } from "@/lib/server/wallets";

export const dynamic = "force-dynamic";

/** Active wallets where the signed-in user is a member, with their role. */
export async function GET() {
  const actor = await requireActor();
  if (actor instanceof Response) return actor;
  return Response.json({ wallets: await listWallets(actor.userId) });
}

/** Creates a wallet; the creator becomes its OWNER. */
export async function POST(request: Request) {
  return walletWrite(request, createWalletInput, (actor, input) => createWallet(actor, input), 201);
}
