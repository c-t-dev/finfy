"use client";

import * as React from "react";
import { useAnimate, useReducedMotion } from "motion/react";

/** Animate the existing container without remounting forms or delaying navigation. */
export function ScreenTransition({ transitionKey, children, className, emphasis = "subtle" }: {
  transitionKey: string;
  children: React.ReactNode;
  className?: string;
  emphasis?: "subtle" | "window";
}) {
  const [scope, animate] = useAnimate();
  const reduceMotion = useReducedMotion();

  React.useEffect(() => {
    const fullMotion = reduceMotion === false;
    const windowEntrance = emphasis === "window";
    const animation = animate(
      scope.current,
      {
        opacity: [windowEntrance ? 0 : 0.65, 1],
        y: fullMotion ? [windowEntrance ? 24 : 6, 0] : [0, 0],
        scale: fullMotion && windowEntrance ? [0.96, 1] : [1, 1],
      },
      { duration: fullMotion ? (windowEntrance ? 0.45 : 0.2) : 0.12, ease: "easeOut" },
    );
    return () => animation.stop();
  }, [transitionKey, reduceMotion, emphasis, animate, scope]);

  return <div ref={scope} className={className}>{children}</div>;
}
