import { APP_NAME } from "@/lib/brand";
import { WorkspacePage } from "@/components/workspace-page";
export const dynamic = "force-dynamic";
import { serverI18n } from "@/lib/i18n/server";
export async function generateMetadata() {
  const { t } = await serverI18n();
  return {
    title: `${t("TEAM WORKSPACE")} | ${APP_NAME}`,
    robots: { index: false, follow: false },
  };
}
export default function Page() {
  return <WorkspacePage />;
}
