import { toAuthResponse, type AuthClient, type AuthResponse } from "@packages/app/auth";

async function post(path: string, body: unknown): Promise<AuthResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });
  return toAuthResponse(await response.json().catch(() => null));
}

/** Web transport: same-origin JSON calls; the session travels in an HttpOnly cookie. */
export const webAuthClient: AuthClient = {
  signIn: (input) => post("/api/auth/sign-in", input),
  signUp: (input) => post("/api/auth/sign-up", input),
  verifyEmail: (input) => post("/api/auth/verify-email", input),
  resendCode: (input) => post("/api/auth/resend-code", input),
};

export async function signOut(): Promise<void> {
  await fetch("/api/auth/sign-out", { method: "POST", credentials: "same-origin" });
}
