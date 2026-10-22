"use client";
import { LanguageSwitcher, useI18n } from "@/components/i18n";
/* eslint-disable @next/next/no-img-element */
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { APP_NAME } from "@/lib/brand";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  ArrowUpRight,
  Bell,
  BellOff,
  ChartNoAxesCombined,
  Check,
  ChefHat,
  Clock3,
  CreditCard,
  Download,
  Edit3,
  LayoutGrid,
  Inbox,
  Leaf,
  LoaderCircle,
  LogOut,
  Plus,
  QrCode,
  Search,
  Settings2,
  ShoppingBag,
  Trash2,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Brand, Sidebar } from "./shell";
import { api } from "@/lib/client";
import { restaurantUrl } from "@/lib/restaurant-url";
import { signOut } from "@/app/actions";
import { bill, type Bucket, type Workspace } from "@/lib/types";

export function Login({ local }: { local: boolean }) {
  const { t: tr } = useI18n();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function login(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("auth/login", {
        email,
        password,
      });
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-story">
        <Brand />
        <div>
          <span className="eyebrow">{tr("orderCup / TEAM ACCESS")}</span>
          <h1>
            {tr("One team.")}
            <br />
            <em>{tr("Every table.")}</em>
          </h1>
          <p>
            {tr("The kitchen, the floor, and everything in between.")}
            <br />
            {tr("One place to keep your restaurant in rhythm.")}
          </p>
          <div className="login-art">
            <QrCode size={112} strokeWidth={0.8} />
            <span>{tr("Your service. In sync.")}</span>
          </div>
        </div>
        <span className="login-story-footer">
          <Leaf size={16} />
          {tr("GUESTS ↔ KITCHEN ↔ SERVICE")}
        </span>
      </div>
      <main className="login-form-panel">
        <div className="login-language">
          <LanguageSwitcher />
        </div>
        <Link href="/" className="back-menu">
          {tr("← Back to home")}
        </Link>
        <form onSubmit={login} className="login-form">
          <span className="eyebrow">{tr("TEAM WORKSPACE")}</span>
          <h2>{tr("Welcome back.")}</h2>
          <p>{tr("Sign in to your restaurant workspace.")}</p>
          <label>
            {tr("Email address")}
            <input
              type="email"
              autoComplete="username"
              placeholder="you@restaurant.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </label>
          <label>
            {tr("Password")}
            <input
              type="password"
              autoComplete="current-password"
              placeholder={tr("Enter your password")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {error && (
            <p role="alert" className="inline-error">
              {tr(error)}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy && <LoaderCircle size={17} className="spin" />}
            {tr("Sign in to your workspace")}
            <ArrowRight size={17} />
          </Button>
          {local && (
            <div className="demo-login">
              <span>{tr("LOCAL DEVELOPMENT ACCOUNTS")}</span>
              <p>
                {tr("Use")} <strong>TableThyme2026!</strong>{" "}
                {tr("with one of these accounts:")}
              </p>
              {["staff", "admin", "controller"].map((role) => (
                <button
                  type="button"
                  key={role}
                  onClick={() => {
                    setEmail(`${role}@tableandthyme.local`);
                    setPassword("TableThyme2026!");
                  }}
                >
                  {role}@tableandthyme.local
                  <ArrowUpRight size={12} />
                </button>
              ))}
            </div>
          )}
        </form>
        <span className="login-footer">{tr("orderCup · Restaurant OS")}</span>
      </main>
    </div>
  );
}

type Edit = {
  entity: string;
  id?: string;
  data: Record<string, string | number | boolean>;
  title: string;
};
export function WorkspaceApp({
  initial,
  kind,
}: {
  initial: Workspace;
  kind: string;
}) {
  const { t: tr, menu: menuText, money, intlLocale } = useI18n();
  const [data, setData] = useState(initial);
  const [tab, setTab] = useState(
    kind === "staff"
      ? "board"
      : kind === "controller"
        ? "restaurants"
        : "overview",
  );
  const [tenant, setTenant] = useState(initial.restaurants[0]?.id ?? "");
  const [search, setSearch] = useState("");
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [edit, setEdit] = useState<Edit | null>(null);
  const [qrTable, setQrTable] = useState<{ id: string; number: number } | null>(
    null,
  );
  const [origin, setOrigin] = useState("");
  const [sound, setSound] = useState(false);
  const [connected, setConnected] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const current = useRef(data);
  const soundRef = useRef(false);
  useEffect(() => {
    current.current = data;
  }, [data]);
  useEffect(() => {
    soundRef.current = sound;
  }, [sound]);
  useEffect(() => {
    const events = new EventSource("/api/events?staff=1");
    events.onopen = () => setConnected(true);
    events.onerror = () => setConnected(false);
    events.onmessage = (e) => {
      const next = JSON.parse(e.data).data as Workspace;
      const old = current.current;
      const newBatch = next.buckets.some((b) =>
        b.batches.some(
          (batch) =>
            !old.buckets.some((ob) =>
              ob.batches.some((bb) => bb.id === batch.id),
            ),
        ),
      );
      const payment = next.buckets.some(
        (b) =>
          b.status === "PAYMENT_REQUESTED" &&
          old.buckets.some((ob) => ob.id === b.id && ob.status === "OPEN"),
      );
      if (newBatch || payment) {
        setToast(
          newBatch
            ? "New order received."
            : "A table has requested their bill.",
        );
        if (soundRef.current && audio.current) {
          const ctx = audio.current;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.frequency.value = 660;
          gain.gain.setValueAtTime(0.12, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
          osc.start();
          osc.stop(ctx.currentTime + 0.6);
        }
      }
      current.current = next;
      setData(next);
    };
    return () => events.close();
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(t);
  }, [toast]);
  const catalog =
    data.catalogs.find((c) => c.restaurant.id === tenant) ?? data.catalogs[0];
  const restaurant = catalog?.restaurant;
  const currency = restaurant?.currency ?? "KZT";
  const buckets = data.buckets.filter(
    (b) => kind === "controller" || b.restaurantId === tenant,
  );
  const openBuckets = buckets.filter((b) => b.status !== "CLOSED");
  const stats = data.analytics;
  const mixedCurrency =
    kind === "controller" &&
    new Set(data.restaurants.map((r) => r.currency)).size > 1;
  const menu = catalog?.menu ?? [];
  const paymentBuckets = openBuckets.filter(
    (b) => b.status === "PAYMENT_REQUESTED",
  );
  const tabs =
    kind === "staff"
      ? [
          {
            id: "board",
            name: tr("Live board"),
            icon: <LayoutGrid size={16} />,
          },
          {
            id: "availability",
            name: tr("Menu availability"),
            icon: <UtensilsCrossed size={16} />,
          },
        ]
      : kind === "controller"
        ? [
            {
              id: "restaurants",
              name: tr("Restaurants"),
              icon: <UtensilsCrossed size={16} />,
            },
            {
              id: "overview",
              name: tr("Platform analytics"),
              icon: <ChartNoAxesCombined size={16} />,
            },
            {
              id: "tables",
              name: tr("Active tables"),
              icon: <Users size={16} />,
            },
            { id: "team", name: tr("Accounts"), icon: <Users size={16} /> },
            {
              id: "requests",
              name: tr("Integration requests"),
              icon: <Inbox size={16} />,
            },
          ]
        : [
            {
              id: "board",
              name: tr("Live board"),
              icon: <LayoutGrid size={16} />,
            },
            {
              id: "overview",
              name: tr("Overview"),
              icon: <ChartNoAxesCombined size={16} />,
            },
            {
              id: "menu",
              name: tr("Menu items"),
              icon: <UtensilsCrossed size={16} />,
            },
            {
              id: "categories",
              name: tr("Categories"),
              icon: <LayoutGrid size={16} />,
            },
            {
              id: "tables",
              name: tr("Tables & QR codes"),
              icon: <QrCode size={16} />,
            },
            { id: "team", name: tr("Team"), icon: <Users size={16} /> },
          ];
  async function mutate(
    entity: string,
    op: string,
    id?: string,
    values: unknown = {},
    extra: Record<string, unknown> = {},
  ) {
    setBusy(true);
    setError("");
    try {
      await api(`manage/${entity}`, {
        op,
        id,
        data: values,
        restaurantId: tenant,
        ...extra,
      });
      const next = await api<Workspace>("workspace");
      current.current = next;
      setData(next);
      setToast("All set. Your changes are saved.");
      return true;
    } catch (e) {
      setError((e as Error).message);
      return false;
    } finally {
      setBusy(false);
    }
  }
  function openCreate(entity: string) {
    const defaults: Record<
      string,
      Record<string, string | number | boolean>
    > = {
      menu: {
        name: "",
        nameKk: "",
        nameEn: "",
        descriptionKk: "",
        descriptionEn: "",
        description: "",
        price: 0,
        costPrice: 0,
        imageUrl: "",
        categoryId: catalog?.categories[0]?.id ?? "",
        isAvailable: true,
      },
      categories: {
        name: "",
        nameKk: "",
        nameEn: "",
        sortOrder: catalog?.categories.length ?? 0,
        isActive: true,
      },
      tables: {
        number:
          Math.max(0, ...(catalog?.tables.map((t) => t.number) ?? [])) + 1,
      },
      restaurants: {
        name: "",
        slug: "",
        currency: "KZT",
        serviceChargePct: 10,
        isActive: true,
        adminName: "",
        adminEmail: "",
        adminPassword: "",
      },
      users: { name: "", email: "", password: "", role: "STAFF" },
    };
    setError("");
    setEdit({
      entity,
      data: defaults[entity],
      title:
        entity === "menu"
          ? tr("Something new on the menu.")
          : entity === "restaurants"
            ? tr("Make room for a new restaurant.")
            : entity === "users"
              ? tr("Welcome someone to the team.")
              : entity === "tables"
                ? tr("A new seat at the table.")
                : tr("A new menu category."),
    });
  }
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!edit) return;
    const values = { ...edit.data };
    let extra = {};
    if (edit.entity === "restaurants") {
      extra = {
        admin: {
          name: values.adminName,
          email: values.adminEmail,
          password: values.adminPassword,
        },
      };
      delete values.adminName;
      delete values.adminEmail;
      delete values.adminPassword;
    }
    if (
      await mutate(
        edit.entity,
        edit.id ? "update" : "create",
        edit.id,
        values,
        extra,
      )
    )
      setEdit(null);
  }
  const field = (
    key: string,
    label: string,
    type = "text",
    required = true,
  ) => (
    <label key={key}>
      {label}
      <input
        type={type}
        required={required}
        value={String(edit?.data[key] ?? "")}
        min={type === "number" ? 0 : undefined}
        step={key === "serviceChargePct" ? "0.1" : "1"}
        onChange={(e) =>
          setEdit((v) =>
            v
              ? {
                  ...v,
                  data: {
                    ...v.data,
                    [key]:
                      type === "number"
                        ? Number(e.target.value)
                        : e.target.value,
                  },
                }
              : v,
          )
        }
      />
    </label>
  );
  function renderOrder(b: Bucket, batch: Bucket["batches"][number]) {
    const c = data.catalogs.find((c) => c.restaurant.id === b.restaurantId)!;
    const items = b.items.filter((i) => i.batchId === batch.id);
    return (
      <article className="order-card" key={batch.id}>
        <div className="order-top">
          <span className="order-table">
            {tr("Table")} {String(b.tableNumber).padStart(2, "0")}
          </span>
          <span>#{String(batch.batchNumber).padStart(2, "0")}</span>
        </div>
        <div className="order-meta">
          <Clock3 size={12} />
          {new Date(batch.createdAt).toLocaleTimeString(intlLocale, {
            hour: "2-digit",
            minute: "2-digit",
          })}
          <span>·</span>
          <Users size={12} />
          {b.participants.length} {tr("guests")}
        </div>
        {items.map((i) => (
          <div className="kitchen-item" key={i.id}>
            <b>{i.quantity}</b>
            <div>
              <strong>
                {menuText(c.menu.find((m) => m.id === i.menuItemId)) ||
                  tr("Menu item")}
              </strong>
              <small>
                {
                  b.participants.find((p) => p.id === i.participantId)
                    ?.displayName
                }
              </small>
            </div>
          </div>
        ))}
        <div className="order-total">
          <span>
            {items.reduce((s, i) => s + i.quantity, 0)} {tr("items")}
          </span>
          <strong>
            {money(
              items.reduce((s, i) => s + i.quantity * i.unitPrice, 0),
              c.restaurant.currency,
            )}
          </strong>
        </div>
        {batch.status !== "SERVED" && (
          <div className="order-actions">
            <Button
              disabled={busy}
              onClick={() =>
                void mutate(
                  "batches",
                  "update",
                  batch.id,
                  { status: batch.status === "PENDING" ? "COOKING" : "SERVED" },
                  { restaurantId: b.restaurantId },
                )
              }
            >
              {batch.status === "PENDING" ? (
                <ChefHat size={15} />
              ) : (
                <Check size={15} />
              )}{" "}
              {batch.status === "PENDING"
                ? tr("Start cooking")
                : tr("Mark served")}
              <ArrowRight size={15} />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy}
              onClick={() =>
                void mutate(
                  "batches",
                  "update",
                  batch.id,
                  { status: "CANCELLED" },
                  { restaurantId: b.restaurantId },
                )
              }
            >
              {tr("Cancel")}
            </Button>
          </div>
        )}
      </article>
    );
  }
  return (
    <div className="app-shell">
      <Sidebar active={kind} />
      <div className="main-shell">
        <header className="topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="breadcrumb">
            {tr("YOUR WORKSPACE")}
            <ArrowRight size={12} />
            <span>
              {kind === "staff"
                ? tr("Kitchen & floor")
                : kind === "controller"
                  ? tr("Platform overview")
                  : tr("Restaurant manager")}
            </span>
          </div>
          <div className="topbar-right">
            <LanguageSwitcher />
            <span className="open-label">
              <span className={connected ? "green-dot" : "amber-dot"} />
              {connected ? tr("Live & connected") : tr("Connecting…")}
            </span>
            <button
              className="icon-button"
              aria-label={
                sound
                  ? tr("Mute notifications")
                  : tr("Enable sound notifications")
              }
              onClick={() => {
                if (!audio.current) audio.current = new AudioContext();
                void audio.current.resume();
                setSound(!sound);
              }}
            >
              {sound ? <Bell size={18} /> : <BellOff size={18} />}
            </button>
            <form action={signOut}>
              <button className="icon-button" aria-label={tr("Sign out")}>
                <LogOut size={17} />
              </button>
            </form>
          </div>
        </header>
        <main className="workspace-main">
          <div className="workspace-intro">
            <div>
              <span className="eyebrow">
                {kind === "controller"
                  ? tr("THE BIGGER PICTURE")
                  : restaurant?.name.toUpperCase()}
              </span>
              <h1>
                {kind === "staff"
                  ? tr("Service overview.")
                  : kind === "controller"
                    ? tr("Every table. One place.")
                    : tr("Restaurant overview.")}
              </h1>
              <p>
                {kind === "staff"
                  ? tr(
                      "Fresh orders, happy tables. Keep the whole team in sync.",
                    )
                  : kind === "controller"
                    ? tr("Restaurants, activity, and integration requests.")
                    : tr("Your orders, menu, team, and performance.")}
              </p>
            </div>
            <div className="workspace-user">
              <span className="avatar avatar-0">{data.user.name[0]}</span>
              <div>
                <strong>{data.user.name}</strong>
                <span>{tr(data.user.role)}</span>
              </div>
            </div>
          </div>
          <div className="workspace-tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={tab === t.id ? "selected" : ""}
                onClick={() => {
                  setTab(t.id);
                  setSearch("");
                }}
              >
                {t.icon}
                {t.name}
                {t.id === "board" && (
                  <span>
                    {
                      openBuckets.flatMap((b) =>
                        b.batches.filter((bb) => bb.status === "PENDING"),
                      ).length
                    }
                  </span>
                )}
              </button>
            ))}
          </div>
          {tab === "board" && (
            <>
              <div className="board-summary">
                <div>
                  <span className="green-dot" />
                  <strong>
                    {openBuckets.length}
                    {tr("active tables")}
                  </strong>
                  <span className="muted">·</span>
                  <span>
                    {
                      buckets.flatMap((b) =>
                        b.batches.filter(
                          (bb) =>
                            bb.status === "PENDING" || bb.status === "COOKING",
                        ),
                      ).length
                    }{" "}
                    {tr("orders in the kitchen")}
                  </span>
                </div>
                <span>
                  <Clock3 size={14} />
                  {tr("Updates automatically")}
                </span>
              </div>
              {paymentBuckets.length > 0 && (
                <section className="payment-alerts">
                  <div className="section-heading">
                    <h2>
                      <CreditCard size={19} />
                      {tr("Ready to settle up")}
                    </h2>
                    <span>
                      {paymentBuckets.length}
                      {tr("payment requests")}
                    </span>
                  </div>
                  <div className="payment-alert-grid">
                    {paymentBuckets.map((b) => {
                      const c = data.catalogs.find(
                        (c) => c.restaurant.id === b.restaurantId,
                      )!;
                      const total = bill(b, c.restaurant.serviceChargePct);
                      return (
                        <div className="payment-alert" key={b.id}>
                          <div className="flex-between">
                            <strong>
                              {tr("Table")}{" "}
                              {String(b.tableNumber).padStart(2, "0")}
                            </strong>
                            <span className="status status-payment">
                              {tr("Pay")}{" "}
                              {b.paymentMode === "SEPARATE"
                                ? tr("separately")
                                : tr("together")}
                            </span>
                          </div>
                          {b.paymentMode === "SEPARATE" &&
                            total.people.map((p) => (
                              <div className="bill-row" key={p.id}>
                                <span>{p.displayName}</span>
                                <strong>
                                  {money(p.total, c.restaurant.currency)}
                                </strong>
                              </div>
                            ))}
                          <div className="bill-row">
                            <strong>{tr("Including service")}</strong>
                            <strong>
                              {money(total.total, c.restaurant.currency)}
                            </strong>
                          </div>
                          <Button
                            variant="outline"
                            disabled={busy}
                            onClick={() =>
                              void mutate(
                                "buckets",
                                "update",
                                b.id,
                                {},
                                { restaurantId: b.restaurantId },
                              )
                            }
                          >
                            <Check size={15} />
                            {tr("Mark paid & close table")}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              <div className="kanban">
                {["PENDING", "COOKING", "SERVED"].map((status) => {
                  const orders = buckets
                    .filter((b) => b.status !== "CLOSED")
                    .flatMap((b) =>
                      b.batches
                        .filter((bb) => bb.status === status)
                        .map((batch) => ({ bucket: b, batch })),
                    );
                  return (
                    <section
                      className={`kanban-column column-${status.toLowerCase()}`}
                      key={status}
                    >
                      <div className="kanban-heading">
                        <h2>
                          <span
                            className={`status-dot dot-${status.toLowerCase()}`}
                          />
                          {status === "PENDING"
                            ? tr("Fresh orders")
                            : status === "COOKING"
                              ? tr("In the kitchen")
                              : tr("At the table")}
                          <span>{orders.length}</span>
                        </h2>
                        {status === "PENDING" ? (
                          <ShoppingBag size={16} />
                        ) : status === "COOKING" ? (
                          <ChefHat size={17} />
                        ) : (
                          <Check size={17} />
                        )}
                      </div>
                      {orders.length ? (
                        orders.map(({ bucket, batch }) =>
                          renderOrder(bucket, batch),
                        )
                      ) : (
                        <div className="kanban-empty">
                          <Leaf size={26} />
                          <strong>
                            {status === "PENDING"
                              ? tr("All caught up.")
                              : status === "COOKING"
                                ? tr("A quiet moment.")
                                : tr("Good things take time.")}
                          </strong>
                          <p>
                            {status === "PENDING"
                              ? tr("New orders will appear here.")
                              : status === "COOKING"
                                ? tr("Orders in progress will appear here.")
                                : tr("Served orders will appear here.")}
                          </p>
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
            </>
          )}
          {tab === "overview" && (
            <>
              <div className="stats-grid">
                {[
                  {
                    label: tr("Order revenue"),
                    value: mixedCurrency
                      ? tr("By restaurant")
                      : money(stats.revenue, currency),
                    icon: <ChartNoAxesCombined size={19} />,
                    note: tr("Confirmed orders · excluding service"),
                  },
                  {
                    label: tr("Orders sent"),
                    value: stats.orders,
                    icon: <ShoppingBag size={19} />,
                    note: tr("{count} tables currently open", {
                      count: stats.active,
                    }),
                  },
                  {
                    label: tr("Average party"),
                    value: new Intl.NumberFormat(intlLocale, {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    }).format(stats.avgParty),
                    icon: <Users size={19} />,
                    note: tr("Guests per table session"),
                  },
                  {
                    label: tr("Spend per guest"),
                    value: mixedCurrency
                      ? tr("By restaurant")
                      : money(stats.avgSpend, currency),
                    icon: <UtensilsCrossed size={19} />,
                    note: tr("Order revenue / all participants"),
                  },
                ].map((m) => (
                  <article className="stat-card" key={m.label}>
                    <div>
                      <span>{m.label}</span>
                      {m.icon}
                    </div>
                    <strong>{m.value}</strong>
                    <small>{m.note}</small>
                  </article>
                ))}
              </div>
              {kind === "controller" &&
                new Set(data.restaurants.map((r) => r.currency)).size > 1 && (
                  <p className="inline-error">
                    {tr(
                      "Restaurants use different currencies. Revenue and spending are shown per restaurant to keep currencies separate.",
                    )}
                  </p>
                )}
              <div className="analytics-grid">
                <section className="panel">
                  <div className="section-heading">
                    <div>
                      <span className="eyebrow">
                        {tr("THE RHYTHM OF YOUR RESTAURANT")}
                      </span>
                      <h2>{tr("When the table gets busy")}</h2>
                    </div>
                    <span className="small-label">{tr("ALMATY TIME")}</span>
                  </div>
                  <div className="heatmap">
                    <div className="heatmap-hours">
                      <span />
                      {[0, 3, 6, 9, 12, 15, 18, 21].map((h) => (
                        <span key={h}>{h}:00</span>
                      ))}
                    </div>
                    {[
                      tr("Mon"),
                      tr("Tue"),
                      tr("Wed"),
                      tr("Thu"),
                      tr("Fri"),
                      tr("Sat"),
                      tr("Sun"),
                    ].map((day, di) => (
                      <div className="heatmap-row" key={day}>
                        <span>{day}</span>
                        {Array.from({ length: 24 }, (_, i) => {
                          const count =
                            stats.hours.find(
                              (h) => h.day === (di + 1) % 7 && h.hour === i,
                            )?.count ?? 0;
                          return (
                            <div
                              key={i}
                              className={`heat-cell level-${Math.min(count, 4)}`}
                              title={tr("{day} {hour}:00 · {count} orders", {
                                day,
                                hour: i,
                                count,
                              })}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                  <div className="heatmap-legend">
                    <span>{tr("Confirmed order batches")}</span>
                    <span>
                      {tr("Less")}
                      <i className="level-0" />
                      <i className="level-1" />
                      <i className="level-2" />
                      <i className="level-4" />
                      {tr("More")}
                    </span>
                  </div>
                </section>
                <section className="panel payment-chart">
                  <span className="eyebrow">{tr("A LITTLE TOGETHERNESS")}</span>
                  <h2>{tr("How tables settle up")}</h2>
                  <div
                    className="donut"
                    style={{
                      background:
                        stats.together + stats.separate
                          ? `conic-gradient(var(--green) ${(stats.together / (stats.together + stats.separate)) * 100}%, #d0d0d0 0)`
                          : "#ededed",
                    }}
                  >
                    <div>
                      <strong>{stats.together + stats.separate}</strong>
                      <span>{tr("bill requests")}</span>
                    </div>
                  </div>
                  <div className="payment-chart-legend">
                    <span>
                      <i className="green-dot" />
                      {tr("Together")}
                      <strong>{stats.together}</strong>
                    </span>
                    <span>
                      <i className="pale-dot" />
                      {tr("Separately")}
                      <strong>{stats.separate}</strong>
                    </span>
                  </div>
                </section>
              </div>
              <section className="panel">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">
                      {tr("WHAT’S FINDING ITS WAY TO THE TABLE")}
                    </span>
                    <h2>{tr("Menu performance")}</h2>
                  </div>
                  <span className="muted">
                    {tr("Most loved to least ordered")}
                  </span>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>{tr("Dish")}</th>
                        <th>{tr("Ordered")}</th>
                        <th>{tr("Removed before ordering")}</th>
                        <th>{tr("Removed by host")}</th>
                        <th>{tr("Revenue")}</th>
                        <th>{tr("Gross margin")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.products.map((p, i) => (
                        <tr key={p.id}>
                          <td>
                            <span className="rank">
                              {String(i + 1).padStart(2, "0")}
                            </span>
                            <strong>
                              {menuText(
                                data.catalogs
                                  .flatMap((c) => c.menu)
                                  .find((m) => m.id === p.id),
                              ) || p.name}
                            </strong>
                          </td>
                          <td>
                            {p.ordered}
                            <div className="bar-chart">
                              <i
                                style={{
                                  width: `${Math.max(0, (p.ordered / Math.max(...stats.products.map((p) => p.ordered), 1)) * 100)}%`,
                                }}
                              />
                            </div>
                          </td>
                          <td>{p.removed}</td>
                          <td>{p.hostRemoved}</td>
                          <td>{money(p.revenue, p.currency)}</td>
                          <td>
                            {p.revenue
                              ? `${Math.round(((p.revenue - p.cost) / p.revenue) * 100)}%`
                              : "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="panel-footnote">
                  <Leaf size={15} />
                  {tr(
                    "Removal counts measure choices before ordering. Use them to understand demand; they do not represent food physically wasted.",
                  )}
                </div>
              </section>
            </>
          )}
          {(tab === "menu" || tab === "availability") && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {tr("FRESH FROM YOUR KITCHEN")}
                  </span>
                  <h2>
                    {tab === "menu"
                      ? tr("A menu worth gathering for.")
                      : tr("Keep your menu in the know.")}
                  </h2>
                </div>
                {tab === "menu" && (
                  <Button
                    disabled={!catalog?.categories.length}
                    onClick={() => openCreate("menu")}
                  >
                    <Plus size={16} />
                    {tr("Add menu item")}
                  </Button>
                )}
              </div>
              {tab === "menu" && !catalog?.categories.length && (
                <p className="form-hint">
                  {tr("Create a category first, then add your dishes.")}
                </p>
              )}
              <div className="search-field">
                <Search size={17} />
                <input
                  aria-label={tr("Search dishes")}
                  placeholder={tr("Find a dish…")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{tr("Dish")}</th>
                      <th>{tr("Category")}</th>
                      <th>{tr("Price")}</th>
                      {tab === "menu" && <th>{tr("Cost price")}</th>}
                      <th>{tr("Availability")}</th>
                      {tab === "menu" && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {menu
                      .filter((m) =>
                        [m.name, m.nameKk, m.nameEn].some((name) =>
                          name?.toLowerCase().includes(search.toLowerCase()),
                        ),
                      )
                      .map((m) => (
                        <tr key={m.id}>
                          <td>
                            <div className="table-dish">
                              {m.imageUrl ? (
                                <img src={m.imageUrl} alt="" />
                              ) : (
                                <span className="dish-placeholder">
                                  <UtensilsCrossed size={20} />
                                </span>
                              )}
                              <div>
                                <strong>{menuText(m)}</strong>
                                <small>{menuText(m, "description")}</small>
                              </div>
                            </div>
                          </td>
                          <td>
                            {menuText(
                              catalog?.categories.find(
                                (c) => c.id === m.categoryId,
                              ),
                            )}
                          </td>
                          <td>{money(m.price, currency)}</td>
                          {tab === "menu" && (
                            <td>{money(m.costPrice ?? 0, currency)}</td>
                          )}
                          <td>
                            <button
                              role="switch"
                              aria-checked={m.isAvailable}
                              aria-label={`${m.isAvailable ? tr("Disable") : tr("Enable")} ${menuText(m)}`}
                              className={`toggle ${m.isAvailable ? "on" : ""}`}
                              disabled={busy}
                              onClick={() =>
                                void mutate(
                                  "menu",
                                  "update",
                                  m.id,
                                  kind === "staff"
                                    ? { isAvailable: !m.isAvailable }
                                    : {
                                        name: m.name,
                                        nameKk: m.nameKk ?? "",
                                        nameEn: m.nameEn ?? "",
                                        descriptionKk: m.descriptionKk ?? "",
                                        descriptionEn: m.descriptionEn ?? "",
                                        description: m.description ?? "",
                                        price: m.price,
                                        costPrice: m.costPrice ?? 0,
                                        imageUrl: m.imageUrl ?? "",
                                        categoryId: m.categoryId,
                                        isAvailable: !m.isAvailable,
                                      },
                                )
                              }
                            >
                              <i />
                            </button>
                            <span className="toggle-label">
                              {m.isAvailable ? tr("Available") : tr("Sold out")}
                            </span>
                          </td>
                          {tab === "menu" && (
                            <td>
                              <div className="row-actions">
                                <button
                                  className="icon-button"
                                  aria-label={tr("Edit {name}", {
                                    name: menuText(m),
                                  })}
                                  onClick={() => {
                                    setError("");
                                    setEdit({
                                      entity: "menu",
                                      id: m.id,
                                      title: tr("Edit menu item."),
                                      data: {
                                        name: m.name,
                                        nameKk: m.nameKk ?? "",
                                        nameEn: m.nameEn ?? "",
                                        descriptionKk: m.descriptionKk ?? "",
                                        descriptionEn: m.descriptionEn ?? "",
                                        description: m.description ?? "",
                                        imageUrl: m.imageUrl ?? "",
                                        price: m.price,
                                        costPrice: m.costPrice ?? 0,
                                        categoryId: m.categoryId,
                                        isAvailable: m.isAvailable,
                                      },
                                    });
                                  }}
                                >
                                  <Edit3 size={16} />
                                </button>
                                <button
                                  className="icon-button danger"
                                  disabled={busy}
                                  aria-label={tr("Delete {name}", {
                                    name: menuText(m),
                                  })}
                                  onClick={() =>
                                    void mutate("menu", "delete", m.id)
                                  }
                                >
                                  <Trash2 size={16} />
                                </button>
                              </div>
                            </td>
                          )}
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!menu.length && (
                <div className="empty-state">
                  <UtensilsCrossed size={30} />
                  <h3>{tr("Your next great menu starts here.")}</h3>
                  <p>{tr("Add a category and your first dish.")}</p>
                </div>
              )}
            </section>
          )}
          {tab === "categories" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {tr("A PLACE FOR EVERY FAVORITE")}
                  </span>
                  <h2>{tr("Your menu categories")}</h2>
                </div>
                <Button onClick={() => openCreate("categories")}>
                  <Plus size={16} />
                  {tr("Add category")}
                </Button>
              </div>
              <div className="category-manage-list">
                {catalog?.categories.map((c) => (
                  <div key={c.id}>
                    <span className="category-number">
                      {String(c.sortOrder + 1).padStart(2, "0")}
                    </span>
                    <div>
                      <strong>{menuText(c)}</strong>
                      <span>
                        {menu.filter((m) => m.categoryId === c.id).length}{" "}
                        {tr("dishes")}
                      </span>
                    </div>
                    <span
                      className={`status ${c.isActive ? "status-served" : "status-cancelled"}`}
                    >
                      {c.isActive ? tr("Active") : tr("Hidden")}
                    </span>
                    <button
                      className="icon-button"
                      aria-label={tr("Edit {name}", { name: menuText(c) })}
                      onClick={() => {
                        setError("");
                        setEdit({
                          entity: "categories",
                          id: c.id,
                          title: tr("Keep your menu organized."),
                          data: {
                            name: c.name,
                            nameKk: c.nameKk ?? "",
                            nameEn: c.nameEn ?? "",
                            sortOrder: c.sortOrder,
                            isActive: c.isActive,
                          },
                        });
                      }}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      className="icon-button danger"
                      disabled={busy}
                      aria-label={tr("Delete {name}", { name: menuText(c) })}
                      onClick={() => void mutate("categories", "delete", c.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
              {!catalog?.categories.length && (
                <div className="empty-state">
                  <LayoutGrid size={30} />
                  <h3>{tr("Everything in its place.")}</h3>
                  <p>{tr("Create your first menu category.")}</p>
                </div>
              )}
            </section>
          )}
          {tab === "tables" && (
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {tr("GOOD COMPANY STARTS HERE")}
                  </span>
                  <h2>
                    {kind === "controller"
                      ? tr("A seat at every restaurant")
                      : tr("A table for everyone.")}
                  </h2>
                </div>
                {kind !== "controller" && (
                  <Button onClick={() => openCreate("tables")}>
                    <Plus size={16} />
                    {tr("Add table")}
                  </Button>
                )}
              </div>
              <div className="tables-grid">
                {(kind === "controller"
                  ? data.catalogs
                  : catalog
                    ? [catalog]
                    : []
                ).flatMap((c) =>
                  c.tables.map((t) => {
                    const bs = data.buckets.filter(
                      (b) => b.tableId === t.id && b.status !== "CLOSED",
                    );
                    return (
                      <article className="table-card" key={t.id}>
                        <div className="flex-between">
                          <span
                            className={`status ${bs.length ? "status-cooking" : "status-served"}`}
                          >
                            <span className="green-dot" />
                            {bs.length
                              ? tr("Occupied")
                              : tr("Ready for company")}
                          </span>
                          {kind !== "controller" && (
                            <div className="row-actions">
                              <button
                                aria-label={tr("Edit table {number}", {
                                  number: t.number,
                                })}
                                className="icon-button"
                                onClick={() => {
                                  setError("");
                                  setEdit({
                                    entity: "tables",
                                    id: t.id,
                                    title: tr("A seat with a new number."),
                                    data: { number: t.number },
                                  });
                                }}
                              >
                                <Edit3 size={14} />
                              </button>
                              <button
                                aria-label={tr("Delete table {number}", {
                                  number: t.number,
                                })}
                                disabled={busy}
                                className="icon-button danger"
                                onClick={() =>
                                  void mutate("tables", "delete", t.id)
                                }
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          )}
                        </div>
                        <UtensilsCrossed size={28} strokeWidth={1.2} />
                        <h3>
                          {tr("Table")} {String(t.number).padStart(2, "0")}
                        </h3>
                        <p>
                          {kind === "controller"
                            ? c.restaurant.name
                            : bs.length
                              ? tr(
                                  "{buckets} active buckets · {guests} guests",
                                  {
                                    buckets: bs.length,
                                    guests: bs.reduce(
                                      (s, b) => s + b.participants.length,
                                      0,
                                    ),
                                  },
                                )
                              : tr("A fresh start for a good meal.")}
                        </p>
                        {kind !== "controller" && (
                          <Button
                            variant="outline"
                            onClick={() => {
                              setOrigin(window.location.origin);
                              setQrTable(t);
                            }}
                          >
                            <QrCode size={15} />
                            {tr("View table QR")}
                            <ArrowUpRight size={14} />
                          </Button>
                        )}
                        {bs.map((b) => (
                          <div className="table-session" key={b.id}>
                            <span>
                              {b.participants.length} {tr("guests ·")}{" "}
                              {b.batches.length} {tr("orders")}
                            </span>
                            <span className="small-label">
                              {b.status === "PAYMENT_REQUESTED"
                                ? tr("BILL REQUESTED")
                                : tr("OPEN")}
                            </span>
                          </div>
                        ))}
                      </article>
                    );
                  }),
                )}
              </div>
            </>
          )}
          {tab === "restaurants" && (
            <>
              <div className="section-heading">
                <div>
                  <span className="eyebrow">{tr("THE RESTAURANT FAMILY")}</span>
                  <h2>{tr("Connected restaurants.")}</h2>
                </div>
                <Button onClick={() => openCreate("restaurants")}>
                  <Plus size={16} />
                  {tr("Add restaurant")}
                </Button>
              </div>
              <div className="restaurants-grid">
                {data.restaurants.map((r) => {
                  const c = data.catalogs.find(
                    (c) => c.restaurant.id === r.id,
                  )!;
                  const bs = data.buckets.filter(
                    (b) => b.restaurantId === r.id,
                  );
                  const revenue = bs.reduce(
                    (sum, b) => sum + bill(b, 0).subtotal,
                    0,
                  );
                  return (
                    <article className="restaurant-card" key={r.id}>
                      <div className="restaurant-card-cover">
                        <UtensilsCrossed size={45} strokeWidth={1.1} />
                        <span
                          className={`status ${r.isActive ? "status-served" : "status-cancelled"}`}
                        >
                          {r.isActive ? tr("Active") : tr("Archived")}
                        </span>
                      </div>
                      <div className="restaurant-card-body">
                        <h3>{r.name}</h3>
                        <p>/{r.slug}</p>
                        <div className="restaurant-metrics">
                          <div>
                            <strong>
                              {bs.filter((b) => b.status !== "CLOSED").length}
                            </strong>
                            <span>{tr("active buckets")}</span>
                          </div>
                          <div>
                            <strong>{c.tables.length}</strong>
                            <span>{tr("tables")}</span>
                          </div>
                          <div>
                            <strong>{money(revenue, r.currency)}</strong>
                            <span>{tr("order revenue")}</span>
                          </div>
                        </div>
                        <div className="row-actions">
                          <Button
                            variant="outline"
                            onClick={() => {
                              setTenant(r.id);
                              setTab("tables");
                            }}
                          >
                            {tr("View tables")}
                            <ArrowRight size={14} />
                          </Button>
                          <button
                            className="icon-button"
                            aria-label={tr("Edit {name}", { name: r.name })}
                            onClick={() => {
                              setTenant(r.id);
                              setError("");
                              setEdit({
                                entity: "restaurants",
                                id: r.id,
                                title: tr("Keep your restaurant in shape."),
                                data: {
                                  name: r.name,
                                  slug: r.slug,
                                  currency: r.currency,
                                  serviceChargePct: r.serviceChargePct,
                                  isActive: r.isActive,
                                },
                              });
                            }}
                          >
                            <Settings2 size={17} />
                          </button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setTenant(r.id);
                              openCreate("users");
                            }}
                          >
                            {tr("Add account")}
                          </Button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </>
          )}
          {tab === "requests" && kind === "controller" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {tr("THE NEXT TABLE TO CONNECT")}
                  </span>
                  <h2>{tr("Restaurant integration requests")}</h2>
                </div>
                <span>
                  {
                    data.integrationRequests.filter((r) => r.status === "NEW")
                      .length
                  }{" "}
                  {tr("new requests")}
                </span>
              </div>
              {data.integrationRequests.length ? (
                <div className="integration-request-list">
                  {data.integrationRequests.map((r) => (
                    <article key={r.id} className="integration-request-card">
                      <div className="flex-between">
                        <div>
                          <h3>{r.restaurantName}</h3>
                          <p>
                            {r.city}
                            {r.tableCount
                              ? tr(" · {count} tables", { count: r.tableCount })
                              : ""}
                          </p>
                        </div>
                        <span
                          className={`status ${r.status === "NEW" ? "status-pending" : "status-served"}`}
                        >
                          {r.status === "NEW"
                            ? tr("New request")
                            : tr("Contacted")}
                        </span>
                      </div>
                      <div className="integration-contact">
                        <strong>{r.contactName}</strong>
                        <a href={`mailto:${r.email}`}>{r.email}</a>
                        {r.phone && <a href={`tel:${r.phone}`}>{r.phone}</a>}
                      </div>
                      {r.notes && (
                        <p className="integration-notes">{r.notes}</p>
                      )}
                      <div className="flex-between">
                        <span className="muted">
                          {new Date(r.createdAt).toLocaleDateString(
                            intlLocale,
                            {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            },
                          )}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={busy}
                          onClick={() =>
                            void mutate(
                              "integration-requests",
                              "update",
                              r.id,
                              {
                                status:
                                  r.status === "NEW" ? "CONTACTED" : "NEW",
                              },
                            )
                          }
                        >
                          {r.status === "NEW" ? (
                            <Check size={14} />
                          ) : (
                            <Inbox size={14} />
                          )}{" "}
                          {r.status === "NEW"
                            ? tr("Mark contacted")
                            : tr("Mark as new")}
                        </Button>
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <Inbox size={35} />
                  <h3>{tr("No integration requests yet.")}</h3>
                  <p>
                    {tr(
                      "Contact requests from the landing page will appear here.",
                    )}
                  </p>
                </div>
              )}
            </section>
          )}
          {tab === "team" && (
            <section className="panel">
              <div className="section-heading">
                <div>
                  <span className="eyebrow">
                    {tr("GOOD SERVICE IS A TEAM SPORT")}
                  </span>
                  <h2>{tr("The people behind your tables.")}</h2>
                </div>
                <Button onClick={() => openCreate("users")}>
                  <Plus size={16} />
                  {tr("Add account")}
                </Button>
              </div>
              {kind === "controller" && (
                <label className="tenant-select">
                  {tr("Restaurant")}
                  <select
                    value={tenant}
                    onChange={(e) => setTenant(e.target.value)}
                  >
                    {data.restaurants.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div className="table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>{tr("Name")}</th>
                      <th>{tr("Email")}</th>
                      <th>{tr("Role")}</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.accounts
                      .filter((a) => a.restaurantId === tenant)
                      .map((a) => (
                        <tr key={a.id}>
                          <td>
                            <div className="table-person">
                              <span className="avatar avatar-0">
                                {a.name[0]}
                              </span>
                              <strong>{a.name}</strong>
                            </div>
                          </td>
                          <td>{a.email}</td>
                          <td>
                            <span className="status status-served">
                              {a.role === "ADMIN" ? tr("Manager") : tr("Staff")}
                            </span>
                          </td>
                          <td>
                            {a.id !== data.user.id &&
                              (kind === "controller" || a.role === "STAFF") && (
                                <div className="row-actions">
                                  <button
                                    className="icon-button"
                                    aria-label={tr("Edit {name}", {
                                      name: a.name,
                                    })}
                                    onClick={() => {
                                      setError("");
                                      setEdit({
                                        entity: "users",
                                        id: a.id,
                                        title: tr(
                                          "Keep your team in the loop.",
                                        ),
                                        data: {
                                          name: a.name,
                                          email: a.email,
                                          role: a.role,
                                          password: "",
                                        },
                                      });
                                    }}
                                  >
                                    <Edit3 size={15} />
                                  </button>
                                  <button
                                    className="icon-button danger"
                                    aria-label={tr("Remove {name}", {
                                      name: a.name,
                                    })}
                                    disabled={busy}
                                    onClick={() =>
                                      void mutate("users", "delete", a.id)
                                    }
                                  >
                                    <Trash2 size={15} />
                                  </button>
                                </div>
                              )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              <div className="panel-footnote">
                <Users size={15} />
                {tr(
                  "Staff can manage orders and availability. Managers can also manage the menu, tables, and staff accounts.",
                )}
              </div>
            </section>
          )}
          <footer className="workspace-footer">
            <Leaf size={14} />
            {tr("Thoughtfully made for your restaurant.")}
            <span>{APP_NAME}</span>
          </footer>
        </main>
      </div>
      <Dialog
        open={!!edit}
        onOpenChange={(v) => {
          if (!v) setEdit(null);
        }}
        title={edit?.title ?? tr("Edit")}
        description={tr("A few details, then you’re good to go.")}
      >
        <form className="form-stack" onSubmit={save}>
          {edit?.entity === "menu" && (
            <>
              {field("name", tr("Dish name (Russian)"))}
              {field("description", tr("Description (Russian)"), "text", false)}
              <details className="menu-translations">
                <summary>{tr("Optional menu translations")}</summary>
                <p>{tr("Empty translations use the Russian version.")}</p>
                {field("nameKk", tr("Name (Kazakh)"), "text", false)}
                {field(
                  "descriptionKk",
                  tr("Description (Kazakh)"),
                  "text",
                  false,
                )}
                {field("nameEn", tr("Name (English)"), "text", false)}
                {field(
                  "descriptionEn",
                  tr("Description (English)"),
                  "text",
                  false,
                )}
              </details>
              <div className="form-columns">
                {field(
                  "price",
                  tr("Price ({currency})", { currency }),
                  "number",
                )}
                {field(
                  "costPrice",
                  tr("Cost price ({currency})", { currency }),
                  "number",
                )}
              </div>
              <label>
                {tr("Category")}
                <select
                  required
                  value={String(edit.data.categoryId)}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      data: { ...edit.data, categoryId: e.target.value },
                    })
                  }
                >
                  {catalog?.categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {menuText(c)}
                    </option>
                  ))}
                </select>
              </label>
              {field("imageUrl", tr("Photo URL (HTTPS)"), "url", false)}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!edit.data.isAvailable}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      data: { ...edit.data, isAvailable: e.target.checked },
                    })
                  }
                />
                {tr("Available to order")}
              </label>
            </>
          )}
          {edit?.entity === "categories" && (
            <>
              {field("name", tr("Category name (Russian)"))}
              <details className="menu-translations">
                <summary>{tr("Optional menu translations")}</summary>
                <p>{tr("Empty translations use the Russian version.")}</p>
                {field("nameKk", tr("Name (Kazakh)"), "text", false)}
                {field("nameEn", tr("Name (English)"), "text", false)}
              </details>
              {field("sortOrder", tr("Sort order (starts at 0)"), "number")}
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!edit.data.isActive}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      data: { ...edit.data, isActive: e.target.checked },
                    })
                  }
                />
                {tr("Visible on the menu")}
              </label>
            </>
          )}
          {edit?.entity === "tables" &&
            field("number", tr("Table number"), "number")}
          {edit?.entity === "restaurants" && (
            <>
              {field("name", tr("Restaurant name"))}
              {field("slug", tr("URL slug (lowercase, use hyphens)"))}
              <div className="form-columns">
                <label>
                  {tr("Currency")}
                  <select
                    value={String(edit.data.currency)}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        data: { ...edit.data, currency: e.target.value },
                      })
                    }
                  >
                    {["KZT", "USD", "EUR", "GBP"].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                {field("serviceChargePct", tr("Service charge (%)"), "number")}
              </div>
              <label className="checkbox-label">
                <input
                  type="checkbox"
                  checked={!!edit.data.isActive}
                  onChange={(e) =>
                    setEdit({
                      ...edit,
                      data: { ...edit.data, isActive: e.target.checked },
                    })
                  }
                />
                {tr("Restaurant is active")}
              </label>
              {!edit.id && (
                <>
                  <div className="form-divider">
                    {tr("RESTAURANT MANAGER ACCOUNT")}
                  </div>
                  {field("adminName", tr("Manager’s name"))}
                  {field("adminEmail", tr("Manager’s email"), "email")}
                  {field(
                    "adminPassword",
                    tr("Initial password (10+ characters)"),
                    "password",
                  )}
                </>
              )}
            </>
          )}
          {edit?.entity === "users" && (
            <>
              {field("name", tr("Full name"))}
              {field("email", tr("Email address"), "email")}
              {field(
                "password",
                edit.id
                  ? tr("New password (optional, 10+ characters)")
                  : tr("Password (10+ characters)"),
                "password",
                !edit.id,
              )}
              {kind === "controller" && (
                <label>
                  {tr("Role")}
                  <select
                    value={String(edit.data.role)}
                    onChange={(e) =>
                      setEdit({
                        ...edit,
                        data: { ...edit.data, role: e.target.value },
                      })
                    }
                  >
                    <option value="STAFF">{tr("Staff")}</option>
                    <option value="ADMIN">{tr("Restaurant manager")}</option>
                  </select>
                </label>
              )}
            </>
          )}
          {error && (
            <p role="alert" className="inline-error">
              {tr(error)}
            </p>
          )}
          <Button type="submit" disabled={busy}>
            {busy && <LoaderCircle size={16} className="spin" />}
            {tr("Save")} <Check size={16} />
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={!!qrTable}
        onOpenChange={(v) => {
          if (!v) setQrTable(null);
        }}
        title={tr("A seat at Table {number}.", {
          number: String(qrTable?.number).padStart(2, "0"),
        })}
        description={tr(
          "Print this QR and place it on the table. Guests can scan it to start a bucket.",
        )}
      >
        <div className="qr-body printable-qr">
          <Brand />
          <h2>{tr("Good food. Better company.")}</h2>
          <div className="qr-frame">
            {qrTable && origin && (
              <QRCodeSVG
                id="table-qr"
                value={`${origin}${restaurantUrl(restaurant!.slug, { table: qrTable.id })}`}
                size={210}
                level="H"
                marginSize={3}
              />
            )}
          </div>
          <strong>
            {tr("TABLE")} {String(qrTable?.number).padStart(2, "0")}
          </strong>
          <p>{tr("Scan. Choose. Share.")}</p>
          <div className="qr-actions">
            <Button onClick={() => window.print()}>
              <Download size={16} />
              {tr("Print table QR")}
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                const el = document.getElementById("table-qr");
                if (!el) return;
                const blob = new Blob(
                  [new XMLSerializer().serializeToString(el)],
                  { type: "image/svg+xml" },
                );
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `table-${qrTable?.number}.svg`;
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              {tr("Download SVG")}
            </Button>
          </div>
        </div>
      </Dialog>
      {error && !edit && (
        <div role="alert" className="toast error-toast">
          {tr(error)}
          <button onClick={() => setError("")}>{tr("Dismiss")}</button>
        </div>
      )}
      {toast && (
        <div role="status" className="toast">
          <Check size={18} />
          {tr(toast)}
        </div>
      )}
    </div>
  );
}
