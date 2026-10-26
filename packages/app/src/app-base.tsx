/**
 * Base path of the signed-in app; public pages live outside it. Kept out of
 * the "use client" modules so server components get the string itself, not a
 * client reference (redirects and links from server pages need the value).
 */
export const APP_BASE = "/app";
