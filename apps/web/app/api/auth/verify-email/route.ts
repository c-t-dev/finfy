import { verifyEmailInput } from "@packages/shared/auth";
import { handleAuth } from "@/lib/server/auth/route";
import { verifyEmail } from "@/lib/server/auth/service";

export async function POST(request: Request) {
  return handleAuth(request, verifyEmailInput, verifyEmail);
}
