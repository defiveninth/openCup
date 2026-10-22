import { APP_NAME } from "@/lib/brand";
import type { Metadata } from "next";
import "./globals.css";

import { serverI18n } from "@/lib/i18n/server";
import { I18nProvider } from "@/components/i18n";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await serverI18n();
  return {
    applicationName: APP_NAME,
    title: `${APP_NAME} — ${t("Good food. Better company.")}`,
    description: t("QR menus, shared ordering, and a live kitchen board."),
    icons: { icon: "/icon.svg" },
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const { locale } = await serverI18n();
  return (
    <html lang={locale}>
      <body>
        <I18nProvider initialLocale={locale}>{children}</I18nProvider>
      </body>
    </html>
  );
}
