"use client";
import { useI18n } from "@/components/i18n";
export default function ErrorPage({ reset }: { reset: () => void }) {
  const { t: tr } = useI18n();
  return (
    <main className="route-loading">
      <span className="eyebrow">{tr("A MOMENT IN THE KITCHEN")}</span>
      <h1>{tr("We couldn’t set the table.")}</h1>
      <p>
        {tr("Please try again in a moment. If this is your first local run,")}
        <br />
        {tr("follow the database setup in the README.")}
      </p>
      <button className="button button-primary" onClick={reset}>
        {tr("Try again →")}
      </button>
    </main>
  );
}
