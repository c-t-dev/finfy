/** Header the proxy sets on /app requests, so the layout knows the path to come back to. */
export const PATH_HEADER = "x-finfy-path";

/**
 * Where to go after signing in. Only paths inside the signed-in app are
 * accepted, so a crafted link cannot send anyone to another site.
 */
export function safeNextPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/app/") || value.startsWith("//") || value.includes("\\")) return null;
  return /^\/app\/[A-Za-z0-9/_-]*$/.test(value) ? value : null;
}
