import { signInInput } from "@packages/shared/auth";
import { handleAuth } from "@/lib/server/auth/route";
import { signIn } from "@/lib/server/auth/service";

export async function POST(request: Request) {
  return handleAuth(request, signInInput, signIn);
}
