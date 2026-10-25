import { resendCodeInput } from "@packages/shared/auth";
import { handleAuth } from "@/lib/server/auth/route";
import { resendCode } from "@/lib/server/auth/service";
import { EMAIL_DELIVERY_ENABLED } from "@/lib/server/mail";
import { apiError } from "@/lib/server/request";

/** E-mail codes only exist while e-mail delivery is on. */
export async function POST(request: Request) {
  if (!EMAIL_DELIVERY_ENABLED) return apiError("unavailable", 404);
  return handleAuth(request, resendCodeInput, (input) => resendCode(input.email));
}
