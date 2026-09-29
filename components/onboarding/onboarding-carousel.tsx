"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import clsx from "clsx";
import { typography } from "@/constants/typography";

export interface OnboardingSlide {
  illustration: ReactNode;
  title: string;
  line: string;
}

interface OnboardingCarouselProps {
  slides: OnboardingSlide[];
  /** Idle time before advancing to the next slide, in ms. 0 disables it. */
  autoAdvanceMs?: number;
  className?: string;
}

/**
 * Welcome onboarding: swipeable, one illustration + one line per slide.
 *
 * Native scroll-snap gives touch dragging and momentum for free (matching
 * {@link Carousel}). Slides also advance on their own every `autoAdvanceMs`,
 * looping back to the first; the timer is keyed to the active slide, so any
 * manual swipe restarts the countdown rather than fighting the user. Honours
 * `prefers-reduced-motion` by staying put.
 */
export function OnboardingCarousel({ slides, autoAdvanceMs = 5000, className }: OnboardingCarouselProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    setActive(Math.round(track.scrollLeft / track.clientWidth));
  };

  useEffect(() => {
    if (!autoAdvanceMs || slides.length < 2) return;
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      return;
    }

    const timer = window.setTimeout(() => {
      const track = trackRef.current;
      if (!track) return;
      const next = (active + 1) % slides.length;
      track.scrollTo({ left: next * track.clientWidth, behavior: "smooth" });
    }, autoAdvanceMs);

    return () => window.clearTimeout(timer);
  }, [active, autoAdvanceMs, slides.length]);

  return (
    <div className={clsx("flex flex-1 flex-col text-primary", className)}>
      <div
        ref={trackRef}
        onScroll={handleScroll}
        className="flex flex-1 snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {slides.map((slide, index) => (
          <div
            key={index}
            className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-6 text-center"
          >
            <div className="mb-8 h-60 w-60">{slide.illustration}</div>
            <h2 style={typography.display4} className="mb-2 text-text">
              {slide.title}
            </h2>
            <p style={typography.body1} className="max-w-xs text-text-secondary">
              {slide.line}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-6 flex justify-center gap-1.5">
        {slides.map((_, index) => (
          <span
            key={index}
            className={clsx(
              "h-1.5 rounded-full transition-all",
              index === active ? "w-4 bg-primary" : "w-1.5 bg-card"
            )}
          />
        ))}
      </div>
    </div>
  );
}
