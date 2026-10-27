import { CardScreen } from "@packages/app/screens/card";

export default async function Page({ params, searchParams }: PageProps<"/app/accounts/cards/[cardId]">) {
  const { cardId } = await params;
  const { month } = await searchParams;
  const initialMonth = typeof month === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(month) ? month : undefined;
  return <CardScreen cardId={cardId} initialMonth={initialMonth} />;
}
