"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "@base-ui/react/popover";

import { cn } from "@/lib/utils";

/**
 * Small hover/tap popover for secondary detail behind a number (e.g. "what I actually owe").
 * Opens on hover (desktop) AND on click/tap (mobile) so it works on both.
 */
export function Hint({
  content,
  children,
  className,
  side = "top",
}: {
  content: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  side?: "top" | "bottom" | "left" | "right";
}) {
  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger
        openOnHover
        delay={150}
        closeDelay={80}
        className={cn("cursor-help bg-transparent p-0 text-inherit font-inherit", className)}
        render={<span role="button" tabIndex={0} />}
      >
        {children}
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Positioner side={side} sideOffset={6} className="z-50">
          <PopoverPrimitive.Popup
            className="rounded-[12px] px-3 py-2 text-[12px] font-semibold shadow-lg outline-none data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
            style={{
              background: "rgba(255,255,255,.96)",
              border: "1px solid rgba(120,110,180,.22)",
              color: "var(--tj-ink, #26233a)",
              backdropFilter: "blur(10px)",
              maxWidth: 260,
            }}
          >
            {content}
          </PopoverPrimitive.Popup>
        </PopoverPrimitive.Positioner>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
