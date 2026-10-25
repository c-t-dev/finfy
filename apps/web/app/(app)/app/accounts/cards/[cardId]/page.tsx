import { CardScreen } from "@packages/app/screens/card";

export default async function Page({ params }: PageProps<"/app/accounts/cards/[cardId]">) {
  const { cardId } = await params;
  return <CardScreen cardId={cardId} />;
}
