import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

/** Locale-aware Link and router for the public pages. */
export const { Link, usePathname, useRouter, getPathname } = createNavigation(routing);
