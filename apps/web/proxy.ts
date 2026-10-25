import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  // Public pages only: skip the signed-in app, the API, Next internals and files.
  matcher: ["/((?!app(?:/|$)|api(?:/|$)|_next|_vercel|.*\\..*).*)"],
};
