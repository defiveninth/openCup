"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, Globe2 } from "lucide-react";
import {
  intlLocales,
  localeNames,
  locales,
  menuText,
  translate,
  type Locale,
  type MenuTranslations,
} from "@/lib/i18n";
const I18nContext = createContext({
  locale: "kk" as Locale,
  setLocale: (() => {}) as (locale: Locale) => void,
});
export function I18nProvider({
  initialLocale,
  children,
}: {
  initialLocale: Locale;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [locale, setLocaleState] = useState(initialLocale);
  const setLocale = useCallback(
    (next: Locale) => {
      setLocaleState(next);
      document.cookie = `locale=${next}; Path=/; Max-Age=31536000; SameSite=Lax`;
      document.documentElement.lang = next;
      router.refresh();
    },
    [router],
  );
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale }), [locale, setLocale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
export function useI18n() {
  const { locale, setLocale } = useContext(I18nContext);
  const t = useCallback(
    (key: string, values?: Record<string, string | number>) =>
      translate(locale, key, values),
    [locale],
  );
  const menu = useCallback(
    (
      item:
        | ({ name: string; description?: string | null } & MenuTranslations)
        | undefined,
      field: "name" | "description" = "name",
    ) => menuText(item, locale, field),
    [locale],
  );
  const money = useCallback(
    (amount: number, currency = "KZT") =>
      new Intl.NumberFormat(intlLocales[locale], {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(amount),
    [locale],
  );
  return { locale, setLocale, t, menu, money, intlLocale: intlLocales[locale] };
}
export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t: tr } = useI18n();
  return (
    <label
      className={`language-switcher${compact ? " language-switcher-compact" : ""}`}
    >
      {compact ? (
        <span className="language-current" aria-hidden="true">
          {locale.toUpperCase()}
          <ChevronDown size={12} />
        </span>
      ) : (
        <Globe2 size={16} aria-hidden="true" />
      )}
      <span className="sr-only">{tr("Language")}</span>
      <select
        aria-label={tr("Language")}
        value={locale}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {locales.map((code) => (
          <option key={code} value={code} lang={code}>
            {localeNames[code]}
          </option>
        ))}
      </select>
    </label>
  );
}
