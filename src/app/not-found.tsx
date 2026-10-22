import { LanguageSwitcher } from "@/components/i18n";
import { serverI18n } from "@/lib/i18n/server";
import Link from "next/link";
export default async function NotFound() {
  const { t: tr } = await serverI18n();
  return (
    <main className="route-loading">
      <LanguageSwitcher />
      <span className="eyebrow">{tr("A LITTLE LOST?")}</span>
      <h1>{tr("This table isn’t here.")}</h1>
      <p>{tr("Check your QR code or ask a member of the team.")}</p>
      <Link className="button button-primary" href="/">
        {tr("Back to the menu →")}
      </Link>
    </main>
  );
}
