import { signUpInput } from "@packages/shared/auth";
import { handleAuth } from "@/lib/server/auth/route";
import { signUp } from "@/lib/server/auth/service";

export async function POST(request: Request) {
  return handleAuth(request, signUpInput, signUp);
}
