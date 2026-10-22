"use client";
import { useI18n } from "@/components/i18n";
import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import {
  ArrowUpRight,
  ChartNoAxesCombined,
  ChefHat,
  CircleHelp,
  Globe2,
  LayoutDashboard,
  Settings2,
  UtensilsCrossed,
} from "lucide-react";
export function Brand({ href = "/" }: { href?: string }) {
  const { t: tr } = useI18n();
  return (
    <Link href={href} className="brand">
      <span className="brand-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span>
        {APP_NAME}
        <small>{tr("RESTAURANT OS")}</small>
      </span>
    </Link>
  );
}
export function Sidebar({
  active = "menu",
  menuHref = "/restaurant",
}: {
  active?: string;
  menuHref?: string;
}) {
  const { t: tr } = useI18n();
  const guest = active === "menu";
  return (
    <aside className="sidebar">
      <Brand href={guest ? menuHref : "/"} />
      <div className="sidebar-section-label">
        {guest ? tr("THE RESTAURANT") : tr("YOUR WORKSPACE")}
      </div>
      <nav>
        <Link className="nav-link active" href={guest ? menuHref : "/admin"}>
          {guest ? (
            <UtensilsCrossed size={19} />
          ) : active === "staff" ? (
            <ChefHat size={19} />
          ) : active === "controller" ? (
            <Globe2 size={19} />
          ) : (
            <ChartNoAxesCombined size={19} />
          )}
          {guest
            ? tr("Our menu")
            : active === "staff"
              ? tr("Kitchen & floor")
              : active === "controller"
                ? tr("Platform overview")
                : tr("Restaurant manager")}
          <span className="nav-dot" />
        </Link>
      </nav>
      <div className="sidebar-bottom">
        <div className="sidebar-product">
          <span className="small-label">{APP_NAME}</span>
          <strong>
            {tr("One connected")}
            <br />
            {tr("service.")}
          </strong>
          <span className="sidebar-system">
            <span className="green-dot" />
            {tr("Restaurant OS")}
          </span>
        </div>
        <a className="sidebar-help" href="mailto:hello@ordercup.local">
          <CircleHelp size={17} />
          {tr("Support")}
          <ArrowUpRight size={14} />
        </a>
        <div className="sidebar-footer">
          <span className="green-dot" />
          {tr("Service, connected")}
        </div>
      </div>
    </aside>
  );
}
export function WorkspaceIcon({ kind }: { kind: string }) {
  return kind === "staff" ? (
    <ChefHat />
  ) : kind === "controller" ? (
    <LayoutDashboard />
  ) : (
    <Settings2 />
  );
}
