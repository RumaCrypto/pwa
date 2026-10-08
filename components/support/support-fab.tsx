"use client";

import { Headset } from "lucide-react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { openSupport } from "@/constants/support";

/**
 * Floating support shortcut pinned to the top right of the app column. The
 * zero-height sticky wrapper keeps it inside the max-width column on wide
 * screens and in view while the page scrolls.
 */
export function SupportFab() {
  const { t } = useI18n();

  return (
    <div className="sticky top-0 z-40 h-0">
      <button
        onClick={openSupport}
        aria-label={t("tabs.help.contactSupport.title")}
        className="absolute right-6 top-6 flex h-10 w-10 items-center justify-center rounded-full border border-border-light bg-white shadow-sm active:opacity-70"
      >
        <Headset size={18} />
      </button>
    </div>
  );
}
