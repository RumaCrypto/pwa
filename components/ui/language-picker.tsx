"use client";

import { useState } from "react";
import { Globe } from "lucide-react";
import { useI18n } from "@/lib/i18n/i18n-context";
import { LANGUAGES, NATIVE_NAMES } from "@/lib/i18n/languages";
import { typography } from "@/constants/typography";
import { Card } from "./card";
import { ListRow } from "./list-row";
import { Sheet } from "./sheet";

/** Lets the user override the detected app language; the choice persists via the i18n provider. */
export function LanguagePicker() {
  const { t, language, setLanguage } = useI18n();
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label={t("settings.selectLanguage")}
        className="flex h-10 items-center gap-2 rounded-full border border-border-light bg-white px-4 active:opacity-70"
      >
        <Globe size={16} />
        <span style={typography.label2}>{NATIVE_NAMES[language]}</span>
      </button>

      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title={t("settings.selectLanguage")}
        closeLabel={t("common.cancel")}
      >
        <Card divided>
          {LANGUAGES.map((lang) => (
            <ListRow
              key={lang}
              title={NATIVE_NAMES[lang]}
              selected={lang === language}
              onClick={() => {
                setLanguage(lang);
                setOpen(false);
              }}
            />
          ))}
        </Card>
      </Sheet>
    </>
  );
}
