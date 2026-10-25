import { resendCodeInput } from "@packages/shared/auth";
import { handleAuth } from "@/lib/server/auth/route";
import { resendCode } from "@/lib/server/auth/service";

export async function POST(request: Request) {
  return handleAuth(request, resendCodeInput, (input) => resendCode(input.email));
}
