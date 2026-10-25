"use client";

import { InviteScreen } from "@packages/app/screens/invite";
import { APP_BASE } from "@packages/app/navigation";
import { CURRENT_WALLET_COOKIE } from "@/lib/cookies";

/** After accepting, open the app on the new wallet; a full load brings the new wallet list. */
export function InviteHost({ token }: { token: string }) {
  return (
    <InviteScreen
      token={token}
      onAccepted={(walletId) => {
        document.cookie = `${CURRENT_WALLET_COOKIE}=${walletId}; path=/; max-age=31536000; samesite=lax`;
        window.location.assign(APP_BASE);
      }}
    />
  );
}
