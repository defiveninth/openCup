"use client";
import { useI18n } from "@/components/i18n";
export default function Loading() {
  const { t: tr } = useI18n();
  return (
    <main className="route-loading">
      <span className="loading-leaf">✳</span>
      <p>{tr("Setting the table…")}</p>
    </main>
  );
}
