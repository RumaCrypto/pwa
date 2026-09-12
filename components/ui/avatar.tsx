import clsx from "clsx";
import { typography } from "@/constants/typography";

type Size = "sm" | "md" | "lg";

interface AvatarProps {
  /** Derives initials when `initials` is not given. */
  name?: string;
  initials?: string;
  size?: Size;
  className?: string;
}

const SIZES: Record<Size, { box: string; text: keyof typeof typography }> = {
  sm: { box: "h-8 w-8", text: "label5" },
  md: { box: "h-12 w-12", text: "heading4" },
  lg: { box: "h-14 w-14", text: "heading3" },
};

function initialsFrom(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function Avatar({ name, initials, size = "md", className }: AvatarProps) {
  const { box, text } = SIZES[size];

  return (
    <span
      style={typography[text]}
      className={clsx(
        "flex shrink-0 items-center justify-center rounded-full bg-primary-light text-primary-dark",
        box,
        className
      )}
    >
      {initials ?? (name ? initialsFrom(name) : "?")}
    </span>
  );
}
