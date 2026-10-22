import "server-only";
import { cookies } from "next/headers";
import { parseLocale, translate } from "./index";
export async function serverI18n() {
  const locale = parseLocale((await cookies()).get("locale")?.value);
  return { locale, t: (key: string) => translate(locale, key) };
}
