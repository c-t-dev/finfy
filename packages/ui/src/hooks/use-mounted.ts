import * as React from "react";

/** True after the first client render; use it to avoid hydration mismatches. */
export function useMounted() {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  return mounted;
}
