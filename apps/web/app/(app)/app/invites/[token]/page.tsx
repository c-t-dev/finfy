import { InviteHost } from "@/components/invite-host";

export default async function Page({ params }: PageProps<"/app/invites/[token]">) {
  const { token } = await params;
  return <InviteHost token={token} />;
}
