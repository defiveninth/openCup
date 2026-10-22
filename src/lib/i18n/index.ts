import kk from "./kk.json";
import ru from "./ru.json";
export type Locale = "kk" | "ru" | "en";
export const locales = ["kk", "ru", "en"] as const;
export const localeNames: Record<Locale, string> = {
  kk: "Қазақша",
  ru: "Русский",
  en: "English",
};
export const intlLocales: Record<Locale, string> = {
  kk: "kk-KZ",
  ru: "ru-KZ",
  en: "en-GB",
};
export function parseLocale(value?: string): Locale {
  return locales.includes(value as Locale) ? (value as Locale) : "kk";
}
export function translate(
  locale: Locale,
  key: string,
  values?: Record<string, string | number>,
): string {
  const messages: Record<string, string> =
    locale === "kk" ? kk : locale === "ru" ? ru : {};
  const message = messages[key] ?? key;
  return message.replace(/\{(\w+)\}/g, (match, name) =>
    String(values?.[name] ?? match),
  );
}
export type MenuTranslations = {
  nameKk?: string | null;
  nameEn?: string | null;
  descriptionKk?: string | null;
  descriptionEn?: string | null;
};
export function menuText(
  item:
    | ({ name: string; description?: string | null } & MenuTranslations)
    | undefined,
  locale: Locale,
  field: "name" | "description" = "name",
): string {
  if (!item) return "";
  const translated =
    locale === "ru"
      ? undefined
      : item[
          `${field}${locale === "kk" ? "Kk" : "En"}` as keyof MenuTranslations
        ];
  return translated?.trim() || item[field] || "";
}
