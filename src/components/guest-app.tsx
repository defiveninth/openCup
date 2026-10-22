"use client";
import { LanguageSwitcher, useI18n } from "@/components/i18n";
/* eslint-disable @next/next/no-img-element */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCheck,
  ChevronRight,
  Clock3,
  Coffee,
  Grid2X2,
  Leaf,
  List,
  LoaderCircle,
  Minus,
  Plus,
  QrCode,
  ShoppingBag,
  Share2,
  Sparkles,
  Trash2,
  Users,
  UtensilsCrossed,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useRouter } from "next/navigation";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Brand, Sidebar } from "./shell";
import { api } from "@/lib/client";
import { restaurantUrl } from "@/lib/restaurant-url";
import { useBucket } from "@/lib/store";
import { bill, type Bucket, type Catalog, type MenuItem } from "@/lib/types";

export function GuestApp({
  catalog: initial,
  bucketId,
  tableId,
  landing = false,
}: {
  catalog: Catalog;
  bucketId?: string;
  tableId?: string;
  landing?: boolean;
}) {
  const { t: tr, menu: menuText, money } = useI18n();
  const router = useRouter();
  const [catalog, setCatalog] = useState(initial);
  const [guestId, setGuestId] = useState("");
  const [guestName, setGuestName] = useState("");
  const [category, setCategory] = useState("all");
  const [view, setView] = useState("grid");
  const [bannerIndex, setBannerIndex] = useState(0);
  const bannerTrack = useRef<HTMLDivElement>(null);
  const [nameOpen, setNameOpen] = useState(false);
  const [qrOpen, setQrOpen] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [tab, setTab] = useState("current");
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const [connected, setConnected] = useState(false);
  const [origin, setOrigin] = useState("");
  const waitingItem = useRef<string | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const { bucket, setBucket, optimistic, finish } = useBucket();
  const table =
    catalog.tables.find((t) => t.id === tableId) ??
    catalog.tables.find((t) => t.number === 8) ??
    catalog.tables[0];
  const me = bucket?.participants.find((p) => p.guestUuid === guestId);
  const host = !!me?.isHost;
  const currency = catalog.restaurant.currency;
  const unconfirmed = bucket?.items.filter((i) => !i.batchId) ?? [];
  const count = unconfirmed.reduce((s, i) => s + i.quantity, 0);
  const subtotal = unconfirmed.reduce(
    (s, i) => s + i.quantity * i.unitPrice,
    0,
  );
  const totals = bucket
    ? bill(bucket, catalog.restaurant.serviceChargePct)
    : null;
  const shareUrl = `${origin}${restaurantUrl(catalog.restaurant.slug, bucket ? { bucket: bucket.id } : table ? { table: table.id } : {})}`;
  const bannerItems = catalog.menu.filter((item) => item.isAvailable);
  const featured = bannerItems[0];
  const activeBanner = Math.min(
    bannerIndex,
    Math.max(0, bannerItems.length - 1),
  );
  function showBanner(index: number) {
    const track = bannerTrack.current;
    if (!track) return;
    const next = Math.max(0, Math.min(index, bannerItems.length - 1));
    track.scrollTo({
      left: next * (track.clientWidth + 16),
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "instant"
        : "smooth",
    });
  }
  const available = !bucket || bucket.status === "OPEN";

  useEffect(() => {
    let cancelled = false;
    setBucket(null, true);
    const name = localStorage.getItem("guestName") ?? "";
    api<{ guestUuid: string }>("session")
      .then(async (session) => {
        if (cancelled) return;
        setGuestName(name);
        setOrigin(window.location.origin);
        setGuestId(session.guestUuid ?? "");
        if (bucketId) {
          if (!name || !session.guestUuid) {
            setNameOpen(true);
            return;
          }
          try {
            const b = await api<Bucket>(`buckets/${bucketId}/join`, {
              displayName: name,
            });
            if (!cancelled) setBucket(b, true);
          } catch (e) {
            try {
              const b = await api<Bucket>(`buckets/${bucketId}`);
              if (!cancelled) setBucket(b, true);
            } catch {
              if (!cancelled) setError((e as Error).message);
            }
          }
        }
      })
      .catch((e) => setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [bucketId, setBucket]);
  useEffect(() => {
    const events = new EventSource(
      `/api/events?slug=${catalog.restaurant.slug}`,
    );
    events.onmessage = (e) => setCatalog(JSON.parse(e.data).data);
    return () => events.close();
  }, [catalog.restaurant.slug]);
  useEffect(() => {
    if (!bucket?.id || !me?.id) return;
    const events = new EventSource(`/api/events?bucket=${bucket.id}`);
    events.onopen = () => setConnected(true);
    events.onmessage = (e) => setBucket(JSON.parse(e.data).data);
    events.onerror = () => setConnected(false);
    return () => {
      events.close();
      setConnected(false);
    };
  }, [bucket?.id, me?.id, setBucket]);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const change = useCallback(
    (
      itemId: string,
      delta: number,
      participantId?: string,
      remove?: boolean,
    ) => {
      const current = useBucket.getState().bucket;
      if (!current) {
        waitingItem.current = itemId;
        setNameOpen(true);
        return;
      }
      const mine = current.participants.find((p) => p.guestUuid === guestId);
      if (!mine) return;
      optimistic(
        itemId,
        participantId ?? mine.id,
        delta,
        remove,
        catalog.menu.find((m) => m.id === itemId)?.price ?? 0,
      );
      queue.current = queue.current
        .catch(() => {})
        .then(async () => {
          try {
            const next = await api<Bucket>(`buckets/${current.id}/items`, {
              menuItemId: itemId,
              delta,
              participantId: participantId ?? mine.id,
              remove,
            });
            finish();
            if (!useBucket.getState().pending) setBucket(next, true);
          } catch (e) {
            finish();
            setError((e as Error).message);
            if (!useBucket.getState().pending) {
              const b = await api<Bucket>(`buckets/${current.id}`);
              setBucket(b, true);
            }
          }
        });
    },
    [guestId, optimistic, finish, setBucket, setError, catalog.menu],
  );

  async function enter() {
    setBusy(true);
    setError("");
    try {
      const identity = await api<{ guestUuid: string; displayName: string }>(
        "guest",
        { displayName: guestName },
      );
      setGuestId(identity.guestUuid);
      localStorage.setItem("guestUuid", identity.guestUuid);
      localStorage.setItem("guestName", identity.displayName);
      let id = bucketId;
      if (id)
        await api(`buckets/${id}/join`, { displayName: identity.displayName });
      else {
        if (!table)
          throw new Error(
            tr("There are no tables available. Please ask a member of staff."),
          );
        const created = await api<{ id: string }>("buckets/create", {
          displayName: identity.displayName,
          tableId: table.id,
          restaurantId: catalog.restaurant.id,
        });
        id = created.id;
      }
      if (waitingItem.current) {
        await api(`buckets/${id}/items`, {
          menuItemId: waitingItem.current,
          delta: 1,
        });
        waitingItem.current = null;
      }
      const next = await api<Bucket>(`buckets/${id}`);
      setBucket(next, true);
      setNameOpen(false);
      localStorage.setItem("currentBucket", id);
      if (!bucketId)
        router.push(restaurantUrl(catalog.restaurant.slug, { bucket: id }));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  async function action(kind: string, body = {}) {
    if (!bucket) return;
    setBusy(true);
    setError("");
    await queue.current.catch(() => {});
    try {
      const next = await api<Bucket>(`buckets/${bucket.id}/${kind}`, body);
      setBucket(next, true);
      if (kind === "confirm") {
        setTab("history");
        setToast("Sent to the kitchen. Something good is on its way!");
      } else {
        setPaymentOpen(false);
        setToast("Your waiter has been notified.");
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  const filtered = catalog.menu.filter(
    (i) => category === "all" || i.categoryId === category,
  );
  const renderCounter = ({
    item,
    participantId,
    editable = true,
  }: {
    item: MenuItem;
    participantId?: string;
    editable?: boolean;
  }) => {
    const qty = unconfirmed
      .filter(
        (i) =>
          i.menuItemId === item.id &&
          i.participantId === (participantId ?? me?.id),
      )
      .reduce((s, i) => s + i.quantity, 0);
    if (!editable) return <span className="quantity-label">× {qty}</span>;
    return qty ? (
      <div className="counter">
        <button
          aria-label={tr("Remove one {name}", { name: menuText(item) })}
          disabled={!available}
          onClick={() => change(item.id, -1, participantId)}
        >
          <Minus size={14} />
        </button>
        <span>{qty}</span>
        <button
          aria-label={tr("Add one {name}", { name: menuText(item) })}
          disabled={!available || !item.isAvailable || qty >= 99}
          onClick={() => change(item.id, 1, participantId)}
        >
          <Plus size={14} />
        </button>
      </div>
    ) : (
      <Button
        variant="outline"
        size="sm"
        className="add-button"
        disabled={!item.isAvailable || !available}
        onClick={() => change(item.id, 1)}
      >
        {item.isAvailable ? (
          <>
            {tr("Add")}
            <Plus size={14} />
          </>
        ) : (
          tr("Sold out")
        )}
      </Button>
    );
  };

  return (
    <div className="app-shell">
      <Sidebar
        menuHref={restaurantUrl(
          catalog.restaurant.slug,
          bucketId ? { bucket: bucketId } : tableId ? { table: tableId } : {},
        )}
      />
      <div className="main-shell">
        <header className="topbar guest-header">
          <div className="mobile-brand">
            <Brand
              href={restaurantUrl(
                catalog.restaurant.slug,
                bucketId
                  ? { bucket: bucketId }
                  : tableId
                    ? { table: tableId }
                    : {},
              )}
            />
          </div>
          <div className="breadcrumb">
            {tr("THE RESTAURANT")}
            <ChevronRight size={13} />
            <span>{tr("Our menu")}</span>
          </div>
          <div className="topbar-right">
            <span className="open-label">
              <span className="green-dot" />
              {tr("Kitchen is open")}
            </span>
            <LanguageSwitcher compact />
            <span className="header-divider" />
            <button
              className="share-button"
              aria-label={tr("Share")}
              title={tr("Share")}
              onClick={() => setQrOpen(true)}
            >
              <Share2 size={16} />
              <span>{tr("Share")}</span>
            </button>
          </div>
        </header>
        {landing ? (
          <main className="landing">
            <div className="landing-icon">
              <UtensilsCrossed size={34} />
            </div>
            <span className="eyebrow">
              {tr("WELCOME TO")} {catalog.restaurant.name.toUpperCase()}
            </span>
            <h1>
              {tr("Scan. Order.")}
              <br />
              <em>{tr("Enjoy.")}</em>
            </h1>
            <p>
              {tr("Good food tastes even better together.")}
              <br />
              {tr("Start a bucket and invite your people.")}
            </p>
            <div className="landing-table">
              {tr("TABLE")} {String(table?.number ?? "").padStart(2, "0")}
            </div>
            <Button onClick={() => setNameOpen(true)}>
              {tr("Create New Bucket")}
              <ArrowRight size={17} />
            </Button>
            <div className="landing-hint">
              <QrCode size={20} />
              <span>
                {tr("Joining a friend’s bucket?")}
                <br />
                {tr("Scan the QR code on their phone screen.")}
              </span>
            </div>
          </main>
        ) : (
          <main className="menu-main">
            <div className="page-intro">
              <div>
                <div className="eyebrow">
                  <span className="tiny-line" />
                  {tr("THE MENU /")} {catalog.restaurant.name.toUpperCase()}
                </div>
                <h1>
                  {tr("You’re at table {number}.", {
                    number: bucket?.tableNumber ?? table?.number ?? "—",
                  })}
                </h1>
                <p>{tr("Choose your dishes. Order together.")}</p>
              </div>
              <div className="session-summary">
                {bucket ? (
                  <>
                    <div className="avatar-stack">
                      {bucket.participants.slice(0, 4).map((p, i) => (
                        <span
                          className={`avatar avatar-${i}`}
                          key={p.id}
                          title={p.displayName}
                        >
                          {p.displayName[0].toUpperCase()}
                        </span>
                      ))}
                    </div>
                    <div>
                      <strong>
                        {bucket.participants.length}
                        {tr("at the table")}
                      </strong>
                      <span>
                        <i className={connected ? "green-dot" : "amber-dot"} />
                        {bucket.status === "CLOSED"
                          ? tr("Session closed")
                          : connected
                            ? tr("Connected & sharing")
                            : tr("Reconnecting…")}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="session-icon">
                      <Users size={21} />
                    </div>
                    <div>
                      <strong>{tr("Made to be shared")}</strong>
                      <span>{tr("Your table. One happy bucket.")}</span>
                    </div>
                  </>
                )}
              </div>
            </div>
            {bannerItems.length > 0 && (
              <section
                className="menu-carousel"
                aria-label={tr("Menu highlights")}
              >
                <div
                  className="menu-banner-track"
                  ref={bannerTrack}
                  onScroll={(event) => {
                    const track = event.currentTarget;
                    setBannerIndex(
                      Math.round(track.scrollLeft / (track.clientWidth + 16)),
                    );
                  }}
                >
                  {bannerItems.map((item, index) => (
                    <article
                      className="menu-hero"
                      key={item.id}
                      aria-label={menuText(item)}
                    >
                      <div className="hero-copy">
                        <span className="hero-kicker">
                          <Sparkles size={13} />
                          {tr("THE HOUSE FAVORITE")}
                        </span>
                        <h2>{menuText(item)}</h2>
                        <p>{menuText(item, "description")}</p>
                        <button
                          className="hero-link"
                          onClick={() => {
                            setCategory(item.categoryId);
                            document
                              .getElementById("menu-items")
                              ?.scrollIntoView({
                                behavior: "smooth",
                                block: "start",
                              });
                          }}
                        >
                          {tr("Find your favorite")}
                          <ArrowRight size={16} />
                        </button>
                      </div>
                      <div className="hero-image">
                        {item.imageUrl && (
                          <img
                            src={item.imageUrl}
                            alt={menuText(item)}
                            loading={index === 0 ? "eager" : "lazy"}
                          />
                        )}
                      </div>
                      <span className="hero-index">
                        {String(index + 1).padStart(2, "0")} /{" "}
                        {String(bannerItems.length).padStart(2, "0")}
                      </span>
                    </article>
                  ))}
                </div>
                {bannerItems.length > 1 && (
                  <div className="menu-banner-controls">
                    <div className="menu-banner-dots">
                      {bannerItems.map((item, index) => (
                        <button
                          key={item.id}
                          aria-label={tr("Show {name}", {
                            name: menuText(item),
                          })}
                          aria-current={
                            index === activeBanner ? "true" : undefined
                          }
                          onClick={() => showBanner(index)}
                        >
                          <span />
                        </button>
                      ))}
                    </div>
                    <div className="menu-banner-arrows">
                      <button
                        aria-label={tr("Previous banner")}
                        disabled={activeBanner === 0}
                        onClick={() => showBanner(activeBanner - 1)}
                      >
                        <ArrowLeft size={16} />
                      </button>
                      <button
                        aria-label={tr("Next banner")}
                        disabled={activeBanner === bannerItems.length - 1}
                        onClick={() => showBanner(activeBanner + 1)}
                      >
                        <ArrowRight size={16} />
                      </button>
                    </div>
                  </div>
                )}
              </section>
            )}
            <div className="menu-toolbar" id="menu-items">
              <div className="category-tabs">
                <button
                  className={category === "all" ? "selected" : ""}
                  onClick={() => setCategory("all")}
                >
                  <UtensilsCrossed size={16} />
                  {tr("All dishes")}
                </button>
                {catalog.categories.map((c) => (
                  <button
                    className={category === c.id ? "selected" : ""}
                    onClick={() => setCategory(c.id)}
                    key={c.id}
                  >
                    {menuText(c)}
                  </button>
                ))}
              </div>
              <div className="view-toggle">
                <button
                  aria-label={tr("Card view")}
                  aria-pressed={view === "grid"}
                  className={view === "grid" ? "selected" : ""}
                  onClick={() => setView("grid")}
                >
                  <Grid2X2 size={17} />
                </button>
                <button
                  aria-label={tr("List view")}
                  aria-pressed={view === "list"}
                  className={view === "list" ? "selected" : ""}
                  onClick={() => setView("list")}
                >
                  <List size={19} />
                </button>
              </div>
            </div>
            <div className="menu-section-title">
              <h2>
                {category === "all"
                  ? tr("Explore the menu")
                  : menuText(catalog.categories.find((c) => c.id === category))}
                <span>
                  {filtered.length} {tr("dishes")}
                </span>
              </h2>
              <span>
                <Leaf size={14} />
                {tr("Thoughtfully sourced. Always.")}
              </span>
            </div>
            <div className={`menu-grid ${view === "list" ? "menu-list" : ""}`}>
              {filtered.map((item, index) => {
                const total =
                  bucket?.items
                    .filter((i) => i.menuItemId === item.id && !i.batchId)
                    .reduce((s, i) => s + i.quantity, 0) ?? 0;
                return (
                  <article
                    className={`food-card ${!item.isAvailable ? "sold-out" : ""}`}
                    key={item.id}
                  >
                    <div className="food-image">
                      {item.imageUrl ? (
                        <img
                          loading={index > 2 ? "lazy" : "eager"}
                          src={item.imageUrl}
                          alt={menuText(item)}
                        />
                      ) : (
                        <UtensilsCrossed size={40} />
                      )}
                      <span className="food-tag">
                        {!item.isAvailable ? (
                          tr("BACK SOON")
                        ) : item.id === featured?.id ? (
                          <>
                            <Sparkles size={11} />
                            {tr("HOUSE FAVORITE")}
                          </>
                        ) : (
                          menuText(
                            catalog.categories.find(
                              (c) => c.id === item.categoryId,
                            ),
                          ).toUpperCase()
                        )}
                      </span>
                      {total > 0 && (
                        <span className="in-bucket">
                          <ShoppingBag size={11} />
                          {tr("In bucket:")} {total}
                        </span>
                      )}
                    </div>
                    <div className="food-content">
                      <h3>{menuText(item)}</h3>
                      <p>{menuText(item, "description")}</p>
                      <div className="food-bottom">
                        <strong>{money(item.price, currency)}</strong>
                        {renderCounter({ item })}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            {!filtered.length && (
              <div className="empty-state">
                <Coffee size={32} />
                <h3>{tr("Something good is coming.")}</h3>
                <p>{tr("There are no dishes in this category yet.")}</p>
              </div>
            )}
            <footer className="menu-footer">
              <Leaf size={16} />
              <span>
                {tr(
                  "Food allergies or dietary needs? Let your waiter know. We’re happy to help.",
                )}
              </span>
              <span>
                {tr("Prices in")}
                {currency} · {catalog.restaurant.serviceChargePct}
                {tr("% service charge")}
              </span>
            </footer>
          </main>
        )}
        {!landing && (
          <div className={`bucket-bar ${count ? "has-items" : ""}`}>
            <div className="bucket-bar-icon">
              <ShoppingBag size={21} />
              {count > 0 && <b>{count}</b>}
            </div>
            <div className="bucket-bar-copy">
              <strong>
                {bucket?.status === "CLOSED"
                  ? tr("Thanks for sharing your table.")
                  : bucket?.status === "PAYMENT_REQUESTED"
                    ? tr("Your waiter is on the way")
                    : count
                      ? tr("Your table’s bucket")
                      : tr("Your bucket starts here")}
              </strong>
              <span>
                {count ? (
                  <>
                    {count} {count === 1 ? tr("item") : tr("items")}
                    <span className="mobile-bucket-price">
                      {" "}
                      · {money(subtotal, currency)}
                    </span>
                    <span className="desktop-bucket-sharing">
                      {" "}
                      {tr("· Shared by your table")}
                    </span>
                  </>
                ) : bucket?.batches.length ? (
                  tr("Your orders are with the kitchen")
                ) : (
                  tr("Add dishes to start an order.")
                )}
              </span>
            </div>
            <div className="bucket-bar-total">
              {count > 0 && (
                <>
                  <small>{tr("Bucket total")}</small>
                  <strong>{money(subtotal, currency)}</strong>
                </>
              )}
            </div>
            <Button
              onClick={() => (bucket ? setDrawer(true) : setNameOpen(true))}
            >
              {tr("View bucket")}
              <ArrowRight size={17} />
            </Button>
          </div>
        )}
      </div>
      <Dialog
        open={nameOpen}
        onOpenChange={setNameOpen}
        title={
          bucketId
            ? tr("You’re in good company.")
            : tr("Make yourself at home.")
        }
        description={tr("Just your first name. No account needed.")}
      >
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void enter();
          }}
          className="form-stack"
        >
          <div className="welcome-illustration">
            <UtensilsCrossed size={32} />
            <span>{tr("Good food starts here.")}</span>
          </div>
          <label>
            {tr("Your name")}
            <input
              autoFocus
              autoComplete="given-name"
              placeholder={tr("What should we call you?")}
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              maxLength={40}
              required
            />
          </label>
          <p className="form-hint">
            {tr("You’ll")}
            {bucketId
              ? tr("join your friends’")
              : tr("be the host of a new")}{" "}
            {tr("bucket at Table")}{" "}
            {String(table?.number ?? bucket?.tableNumber ?? "").padStart(
              2,
              "0",
            )}
            .
          </p>
          {error && (
            <p role="alert" className="inline-error">
              {tr(error)}
            </p>
          )}
          <Button disabled={busy || !guestName.trim()} type="submit">
            {busy ? <LoaderCircle className="spin" size={17} /> : null}
            {bucketId ? tr("Join the table") : tr("Create my bucket")}
            <ArrowRight size={17} />
          </Button>
        </form>
      </Dialog>
      <Dialog
        open={qrOpen}
        onOpenChange={setQrOpen}
        title={
          bucket
            ? tr("Bring everyone to the table.")
            : tr("Share this table’s menu.")
        }
        description={
          bucket
            ? tr("Ask your friends to scan this QR code to join your bucket.")
            : tr(
                "Scan this QR code or copy the link to open the menu for this table.",
              )
        }
      >
        <div className="qr-body">
          <div className="qr-frame">
            {origin && (
              <QRCodeSVG value={shareUrl} size={200} level="M" marginSize={2} />
            )}
          </div>
          <span className="eyebrow">
            {tr("TABLE")}{" "}
            {String(bucket?.tableNumber ?? table?.number ?? "—").padStart(
              2,
              "0",
            )}{" "}
            · {catalog.restaurant.name}
          </span>
          <Button
            variant="outline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(shareUrl);
                setToast("Invite link copied.");
              } catch {
                setToast("Copy the link from your browser’s address bar.");
              }
            }}
          >
            {tr("Copy invite link")}
            <ArrowRight size={15} />
          </Button>
          <div className="participant-list">
            {bucket?.participants.map((p, i) => (
              <div key={p.id}>
                <span className={`avatar avatar-${i % 4}`}>
                  {p.displayName[0].toUpperCase()}
                </span>
                <strong>
                  {p.displayName}
                  {p.guestUuid === guestId ? tr(" (you)") : ""}
                </strong>
                <span className="muted">
                  {p.isHost ? tr("Host") : tr("At the table")}
                </span>
                <Check size={15} />
              </div>
            ))}
          </div>
        </div>
      </Dialog>
      <Dialog
        open={drawer}
        onOpenChange={setDrawer}
        title={tr("Your table’s bucket")}
        description={tr("Table {number} · A good meal, together.", {
          number: String(bucket?.tableNumber).padStart(2, "0"),
        })}
        drawer
      >
        <div className="drawer-tabs">
          <button
            className={tab === "current" ? "selected" : ""}
            onClick={() => setTab("current")}
          >
            {tr("Current bucket")}
            <span>{count}</span>
          </button>
          <button
            className={tab === "history" ? "selected" : ""}
            onClick={() => setTab("history")}
          >
            {tr("Orders & bill")}
            <span>{bucket?.batches.length ?? 0}</span>
          </button>
        </div>
        <div className="drawer-scroll">
          {tab === "current" ? (
            <>
              {!count ? (
                <div className="empty-state">
                  <ShoppingBag size={36} />
                  <h3>{tr("A little room for something good.")}</h3>
                  <p>
                    {tr("Add a few favorites from the menu.")}
                    <br />
                    {tr("They’ll all find their way here.")}
                  </p>
                  <Button variant="outline" onClick={() => setDrawer(false)}>
                    {tr("Explore the menu")}
                    <ArrowRight size={15} />
                  </Button>
                </div>
              ) : (
                bucket?.participants
                  .filter((p) =>
                    unconfirmed.some((i) => i.participantId === p.id),
                  )
                  .map((p, index) => (
                    <section className="person-order" key={p.id}>
                      <div className="person-heading">
                        <span className={`avatar avatar-${index % 4}`}>
                          {p.displayName[0].toUpperCase()}
                        </span>
                        <strong>
                          {p.displayName}
                          {p.id === me?.id ? tr(" (you)") : ""}
                        </strong>
                        {p.isHost && (
                          <span className="host-badge">{tr("HOST")}</span>
                        )}
                      </div>
                      {unconfirmed
                        .filter((i) => i.participantId === p.id)
                        .map((i) => {
                          const item = catalog.menu.find(
                            (m) => m.id === i.menuItemId,
                          );
                          return (
                            <div className="cart-row" key={i.id}>
                              <div>
                                <strong>
                                  {menuText(item) || tr("Menu item")}
                                </strong>
                                <span>
                                  {money(i.unitPrice, currency)}
                                  {tr("each")}
                                </span>
                              </div>
                              {item &&
                                renderCounter({
                                  item,
                                  participantId: p.id,
                                  editable: host || p.id === me?.id,
                                })}
                              <strong>
                                {money(i.quantity * i.unitPrice, currency)}
                              </strong>
                              {(host || p.id === me?.id) && (
                                <button
                                  aria-label={tr("Remove {name}", {
                                    name: menuText(item),
                                  })}
                                  className="icon-button"
                                  disabled={!available}
                                  onClick={() =>
                                    change(i.menuItemId, -1, p.id, true)
                                  }
                                >
                                  <Trash2 size={14} />
                                </button>
                              )}
                            </div>
                          );
                        })}
                    </section>
                  ))
              )}
              <div className="ownership-note">
                <Users size={17} />
                {host
                  ? tr(
                      "You’re the host. You can edit everyone’s current items and send the order when the table is ready.",
                    )
                  : tr(
                      "Your choices, your controls. The host sends the table’s order when everyone is ready.",
                    )}
              </div>
            </>
          ) : (
            <>
              {!bucket?.batches.length ? (
                <div className="empty-state">
                  <Clock3 size={35} />
                  <h3>{tr("The best is yet to come.")}</h3>
                  <p>{tr("Confirmed orders will appear here.")}</p>
                </div>
              ) : (
                bucket.batches.map((b) => (
                  <section className="batch-section" key={b.id}>
                    <div className="batch-heading">
                      <strong>
                        {tr("Order")}
                        {String(b.batchNumber).padStart(2, "0")}
                      </strong>
                      <span
                        className={`status status-${b.status.toLowerCase()}`}
                      >
                        {b.status === "SERVED" ? (
                          <CheckCheck size={12} />
                        ) : (
                          <Clock3 size={12} />
                        )}{" "}
                        {tr(b.status)}
                      </span>
                    </div>
                    {bucket.items
                      .filter((i) => i.batchId === b.id)
                      .map((i) => (
                        <div className="bill-row" key={i.id}>
                          <span>
                            {i.quantity} ×{" "}
                            {menuText(
                              catalog.menu.find((m) => m.id === i.menuItemId),
                            ) || tr("Menu item")}
                            <small>
                              {
                                bucket.participants.find(
                                  (p) => p.id === i.participantId,
                                )?.displayName
                              }
                            </small>
                          </span>
                          <strong>
                            {money(i.quantity * i.unitPrice, currency)}
                          </strong>
                        </div>
                      ))}
                  </section>
                ))
              )}
              {totals && bucket?.batches.length ? (
                <section className="bill-totals">
                  <div>
                    <span>{tr("Subtotal")}</span>
                    <span>{money(totals.subtotal, currency)}</span>
                  </div>
                  <div>
                    <span>
                      {tr("Service charge (")}
                      {catalog.restaurant.serviceChargePct}%)
                    </span>
                    <span>{money(totals.service, currency)}</span>
                  </div>
                  <div className="grand-total">
                    <strong>{tr("Table total")}</strong>
                    <strong>{money(totals.total, currency)}</strong>
                  </div>
                  <h4>{tr("Everyone’s share")}</h4>
                  {totals.people.map((p) => (
                    <div key={p.id}>
                      <span>{p.displayName}</span>
                      <strong>{money(p.total, currency)}</strong>
                    </div>
                  ))}
                  <small>
                    {tr(
                      "Includes service charge. Cancelled orders are excluded.",
                    )}
                  </small>
                </section>
              ) : null}
            </>
          )}
        </div>
        <div className="drawer-bottom">
          {error && (
            <p role="alert" className="inline-error">
              {tr(error)}
            </p>
          )}
          {bucket?.status === "PAYMENT_REQUESTED" ? (
            <div className="payment-sent">
              <Check size={20} />
              <div>
                <strong>{tr("Your waiter is on the way.")}</strong>
                <span>
                  {tr("Paying")}{" "}
                  {bucket.paymentMode === "SEPARATE"
                    ? tr("separately")
                    : tr("together")}{" "}
                  {tr("· Please pay your waiter.")}
                </span>
              </div>
            </div>
          ) : bucket?.status === "CLOSED" ? (
            <div className="payment-sent">
              <CheckCheck size={23} />
              {tr("All settled. See you at the table again.")}
            </div>
          ) : host ? (
            <>
              <div className="drawer-subtotal">
                <span>
                  {tab === "current" ? tr("Current bucket") : tr("Table total")}
                </span>
                <strong>
                  {money(
                    tab === "current" ? subtotal : (totals?.total ?? 0),
                    currency,
                  )}
                </strong>
              </div>
              <Button
                disabled={
                  busy || (tab === "current" ? !count : !bucket?.batches.length)
                }
                onClick={() =>
                  tab === "current"
                    ? void action("confirm")
                    : setPaymentOpen(true)
                }
              >
                {busy ? (
                  <LoaderCircle className="spin" size={16} />
                ) : tab === "current" ? (
                  <UtensilsCrossed size={17} />
                ) : (
                  <CheckCheck size={17} />
                )}{" "}
                {tab === "current"
                  ? tr("Confirm Order")
                  : tr("Request Payment")}
                <ArrowRight size={16} />
              </Button>
              <small>
                {tab === "current"
                  ? tr("Sent to the kitchen as one happy order.")
                  : tr("Settle up with your waiter. No online payment needed.")}
              </small>
            </>
          ) : (
            <p className="form-hint">
              {tr(
                "Your host will confirm orders and request the bill for the table.",
              )}
            </p>
          )}
        </div>
      </Dialog>
      <Dialog
        open={paymentOpen}
        onOpenChange={setPaymentOpen}
        title={tr("How shall we split it?")}
        description={tr(
          "We’ll let your waiter know. Pay at the table when you’re ready.",
        )}
      >
        <div className="payment-total">
          <span>{tr("The whole happy table")}</span>
          <strong>{money(totals?.total ?? 0, currency)}</strong>
          <small>
            {tr("Including")} {catalog.restaurant.serviceChargePct}
            {tr("% service charge")}
          </small>
        </div>
        {count > 0 && (
          <p className="inline-error">
            {tr(
              "Confirm or remove the current bucket items before requesting payment.",
            )}
          </p>
        )}
        <div className="payment-options">
          <button
            disabled={busy || count > 0}
            onClick={() => void action("request-payment", { mode: "TOGETHER" })}
          >
            <Users size={23} />
            <strong>{tr("Pay Together")}</strong>
            <span>{tr("One table, one bill.")}</span>
            <ArrowRight size={17} />
          </button>
          <button
            disabled={busy || count > 0}
            onClick={() => void action("request-payment", { mode: "SEPARATE" })}
          >
            <UtensilsCrossed size={23} />
            <strong>{tr("Pay Separately")}</strong>
            <span>{tr("Everyone’s own share.")}</span>
            <ArrowRight size={17} />
          </button>
        </div>
        <div className="split-preview">
          {totals?.people.map((p) => (
            <div key={p.id}>
              <span>{p.displayName}</span>
              <strong>{money(p.total, currency)}</strong>
            </div>
          ))}
        </div>
        {error && <p className="inline-error">{tr(error)}</p>}
      </Dialog>
      {error && !nameOpen && !drawer && !paymentOpen && (
        <div className="toast error-toast" role="alert">
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
