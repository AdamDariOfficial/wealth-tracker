import { useCallback } from "react";
import { useAuth } from "@/lib/auth-store";
import { normalizeAppLocale, tr } from "@/lib/i18n";

export function useI18n() {
  const { profile } = useAuth();
  const locale = normalizeAppLocale(profile?.locale);
  const t = useCallback((text: string) => tr(locale, text), [locale]);
  return { locale, t } as const;
}
