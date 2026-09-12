"use client";

import { useRef, useState, type ReactNode } from "react";
import clsx from "clsx";

/**
 * Scroll-snap rather than a JS slider: touch dragging, momentum and
 * accessibility come from the platform, and the dots just follow scroll position.
 */
export function Carousel({ children, className }: { children: ReactNode[]; className?: string }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    setActive(Math.round(track.scrollLeft / track.clientWidth));
  };

  return (
    <div className={className}>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children.map((child, index) => (
          <div key={index} className="w-full shrink-0 snap-center">
            {child}
          </div>
        ))}
      </div>

      {children.length > 1 && (
        <div className="mt-3 flex justify-center gap-1.5">
          {children.map((_, index) => (
            <span
              key={index}
              className={clsx(
                "h-1.5 rounded-full transition-all",
                index === active ? "w-4 bg-primary" : "w-1.5 bg-card"
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
