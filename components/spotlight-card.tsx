"use client";

import type { PointerEvent, ReactNode } from "react";

export function SpotlightCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  function updateSpotlight(event: PointerEvent<HTMLElement>) {
    const bounds = event.currentTarget.getBoundingClientRect();
    event.currentTarget.style.setProperty("--spotlight-x", `${event.clientX - bounds.left}px`);
    event.currentTarget.style.setProperty("--spotlight-y", `${event.clientY - bounds.top}px`);
  }

  return (
    <article
      className={`spotlight-card ${className}`}
      onPointerLeave={(event) => {
        event.currentTarget.style.setProperty("--spotlight-x", "50%");
        event.currentTarget.style.setProperty("--spotlight-y", "50%");
      }}
      onPointerMove={updateSpotlight}
    >
      {children}
    </article>
  );
}
