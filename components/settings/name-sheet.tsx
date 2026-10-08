"use client";

import { useEffect, useState } from "react";

import { Sheet } from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { typography } from "@/constants/typography";
import { useI18n } from "@/lib/i18n/i18n-context";
import { USERNAME_MAX_LENGTH } from "@/lib/settings/username";

interface NameSheetProps {
  open: boolean;
  onClose: () => void;
  /** The name already set, if any, so editing starts from it. */
  current: string | null;
  placeholder: string;
  onSave: (text: string) => void;
}

/** Sets the header name from the home screen, so it isn't only reachable from Settings. */
export function NameSheet({ open, onClose, current, placeholder, onSave }: NameSheetProps) {
  const { t } = useI18n();
  const [draft, setDraft] = useState("");

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect --
       Each opening starts from the saved name, not from a draft left behind. */
    if (open) setDraft(current ?? "");
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [open, current]);

  const save = () => {
    onSave(draft);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("settings.username")}
      closeLabel={t("common.back")}
      footer={
        <Button variant="black" onClick={save}>
          {t("settings.usernameSave")}
        </Button>
      }
    >
      <p style={typography.body4} className="mb-3 text-text-secondary">
        {t("settings.usernameHint")}
      </p>
      <Input
        autoFocus
        maxLength={USERNAME_MAX_LENGTH}
        placeholder={placeholder}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && save()}
      />
    </Sheet>
  );
}
