"use client";
import { LanguageSwitcher, useI18n } from "@/components/i18n";
import { useState } from "react";
import { APP_NAME } from "@/lib/brand";
import {
  ArrowRight,
  ArrowUpRight,
  Circle,
  Check,
  ChefHat,
  ChartNoAxesCombined,
  LoaderCircle,
  QrCode,
  Users,
} from "lucide-react";
import { Brand } from "./shell";
import { Button } from "./ui/button";
import { api } from "@/lib/client";

export function ProductLanding() {
  const { t: tr } = useI18n();
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  async function connect(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(event.currentTarget);
    try {
      await api("integration-requests", {
        restaurantName: form.get("restaurantName"),
        contactName: form.get("contactName"),
        email: form.get("email"),
        phone: form.get("phone"),
        city: form.get("city"),
        tableCount: form.get("tableCount")
          ? Number(form.get("tableCount"))
          : null,
        notes: form.get("notes"),
        website: form.get("website"),
      });
      setSent(true);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="product-page">
      <header className="product-nav">
        <Brand />
        <LanguageSwitcher />
        <a className="product-nav-link" href="#connect">
          {tr("Connect your restaurant")}
          <ArrowRight size={15} />
        </a>
      </header>
      <main>
        <section className="product-banner">
          <div className="product-hero-copy">
            <span className="eyebrow">
              <span className="live-indicator" />
              {tr("RESTAURANT SERVICE, CONNECTED")}
            </span>
            <h1>
              {tr("A better table.")}
              <br />
              <em>{tr("A simpler service.")}</em>
            </h1>
            <p>
              {tr("From the first scan to the final bill.")}
              <br />
              {tr("One place for your guests, kitchen, and team.")}
            </p>
            <Button asChild>
              <a href="#connect">
                {tr("Connect your restaurant")}
                <ArrowUpRight size={18} />
              </a>
            </Button>
            <span className="hero-edition">
              {tr("orderCup / FOR RESTAURANTS")}
            </span>
          </div>
          <ProductArtwork />
          <div className="product-capabilities">
            <span>
              <b>01</b>
              <QrCode size={18} />
              {tr("Scan the menu")}
            </span>
            <span>
              <b>02</b>
              <Users size={18} />
              {tr("Order together")}
            </span>
            <span>
              <b>03</b>
              <ChefHat size={19} />
              {tr("Keep service moving")}
            </span>
          </div>
        </section>
        <section
          className="restaurant-benefits"
          aria-labelledby="restaurant-benefits-title"
        >
          <div className="benefits-heading">
            <span className="eyebrow">
              {tr("01 / WHAT YOUR RESTAURANT GETS")}
            </span>
            <h2 id="restaurant-benefits-title">
              {tr("Less busywork.")}{" "}
              <span>{tr("More time for your guests.")}</span>
            </h2>
            <p>
              {tr(
                "Connect your menu, orders, and team in one system. Keep your service moving from the first scan to the final bill.",
              )}
            </p>
          </div>
          <div className="benefits-grid">
            <article>
              <div className="benefit-icon">
                <QrCode size={24} strokeWidth={1.5} />
                <span>01</span>
              </div>
              <h3>{tr("A menu that stays up to date")}</h3>
              <p>
                {tr(
                  "Guests scan a QR code to open your menu. Update dishes, prices, and availability, with optional Kazakh and English translations.",
                )}
              </p>
            </article>
            <article>
              <div className="benefit-icon">
                <ChefHat size={24} strokeWidth={1.5} />
                <span>02</span>
              </div>
              <h3>{tr("One order. The whole team in sync.")}</h3>
              <p>
                {tr(
                  "Guests order together from their phones. Your team follows each order on a live kitchen board and handles shared or separate bills.",
                )}
              </p>
            </article>
            <article>
              <div className="benefit-icon">
                <ChartNoAxesCombined size={24} strokeWidth={1.5} />
                <span>03</span>
              </div>
              <h3>{tr("A clearer view of your restaurant")}</h3>
              <p>
                {tr(
                  "See order revenue, popular dishes, and busy hours. Manage your menu, tables, and team from one workspace.",
                )}
              </p>
            </article>
          </div>
        </section>
        <section className="connect-section" id="connect">
          <div className="connect-copy">
            <span className="eyebrow">{tr("02 / GET CONNECTED")}</span>
            <h2>
              {tr("Your restaurant.")}
              <br />
              <em>{tr("Next, connected.")}</em>
            </h2>
            <p>
              {tr(
                "Tell us about your restaurant. We’ll contact you to discuss your setup and plan the integration.",
              )}
            </p>
            <div className="connect-note">
              <span className="connect-note-icon">
                <ArrowUpRight size={22} />
              </span>
              <span>
                {tr("Built around your service.")}
                <br />
                <strong>{tr("Set up with your team.")}</strong>
              </span>
            </div>
          </div>
          <div className="connect-form-card">
            {sent ? (
              <div className="connect-success" role="status">
                <span>
                  <Check size={30} />
                </span>
                <span className="eyebrow">{tr("REQUEST RECEIVED")}</span>
                <h3>{tr("Request received.")}</h3>
                <p>
                  {tr("We’ve received your restaurant details.")}
                  <br />
                  {tr("Our team will contact you about the next steps.")}
                </p>
                <button onClick={() => setSent(false)}>
                  {tr("Send another request")}
                  <ArrowRight size={14} />
                </button>
              </div>
            ) : (
              <form onSubmit={connect}>
                <div className="connect-form-heading">
                  <h3>{tr("Connect your restaurant")}</h3>
                  <span>
                    {tr("A few details. Then we’ll take it from here.")}
                  </span>
                </div>
                <div className="connect-form-grid">
                  <label>
                    {tr("Restaurant name")}
                    <input
                      name="restaurantName"
                      placeholder={tr("Your restaurant or café")}
                      autoComplete="organization"
                      required
                      maxLength={120}
                    />
                  </label>
                  <label>
                    {tr("Your name")}
                    <input
                      name="contactName"
                      placeholder={tr("What should we call you?")}
                      autoComplete="name"
                      required
                      maxLength={100}
                    />
                  </label>
                  <label>
                    {tr("Email address")}
                    <input
                      name="email"
                      type="email"
                      placeholder="you@restaurant.com"
                      autoComplete="email"
                      required
                      maxLength={254}
                    />
                  </label>
                  <label>
                    {tr("Phone number")}
                    <span className="optional">{tr("optional")}</span>
                    <input
                      name="phone"
                      type="tel"
                      placeholder="+7 700 000 00 00"
                      autoComplete="tel"
                      maxLength={40}
                    />
                  </label>
                  <label>
                    {tr("City")}
                    <input
                      name="city"
                      placeholder={tr("Where’s your restaurant?")}
                      autoComplete="address-level2"
                      required
                      maxLength={100}
                    />
                  </label>
                  <label>
                    {tr("Number of tables")}
                    <span className="optional">{tr("optional")}</span>
                    <input
                      name="tableCount"
                      type="number"
                      min={1}
                      max={9999}
                      step={1}
                      placeholder={tr("e.g. 12")}
                    />
                  </label>
                  <label className="connect-form-wide">
                    {tr("A little about your restaurant")}{" "}
                    <span className="optional">{tr("optional")}</span>
                    <textarea
                      name="notes"
                      placeholder={tr(
                        "Your concept, current ordering setup, or anything you’d like us to know…",
                      )}
                      maxLength={2000}
                      rows={3}
                    />
                  </label>
                </div>
                <div className="contact-trap" aria-hidden="true">
                  <label>
                    {tr("Leave this field empty")}
                    <input name="website" tabIndex={-1} autoComplete="off" />
                  </label>
                </div>
                {error && (
                  <p className="inline-error" role="alert">
                    {tr(error)}
                  </p>
                )}
                <div className="connect-submit">
                  <span>
                    {tr("We’ll use these details to contact you")}
                    <br />
                    {tr("about connecting your restaurant.")}
                  </span>
                  <Button type="submit" disabled={busy}>
                    {busy ? <LoaderCircle size={16} className="spin" /> : null}
                    {busy ? tr("Sending…") : tr("Let’s connect")}
                    <ArrowRight size={16} />
                  </Button>
                </div>
              </form>
            )}
          </div>
        </section>
      </main>
      <footer className="product-footer">
        <span>
          © {new Date().getFullYear()} {APP_NAME}
        </span>
        <span>
          <Circle size={9} fill="currentColor" />
          {tr("Ordering. Connected.")}
        </span>
        <a href="#connect">
          {tr("Let’s talk")}
          <ArrowRight size={13} />
        </a>
      </footer>
    </div>
  );
}

function ProductArtwork() {
  const { t: tr } = useI18n();
  const dots = Array.from({ length: 19 }, (_, row) =>
    Array.from({ length: 32 }, (_, col) => {
      const latitude = (row / 18 - 0.5) * Math.PI;
      const longitude = (col / 31) * Math.PI;
      const x = 280 + Math.cos(longitude) * Math.cos(latitude) * 205;
      const y = 260 + Math.sin(latitude) * 205;
      const z = Math.sin(longitude) * Math.cos(latitude);
      return (
        <circle
          key={`${row}-${col}`}
          cx={x.toFixed(4)}
          cy={y.toFixed(4)}
          r={(0.7 + z * 0.8).toFixed(4)}
          opacity={(0.15 + z * 0.6).toFixed(4)}
        />
      );
    }),
  );
  return (
    <div
      className="product-artwork"
      aria-label={tr("Illustration of a connected restaurant workflow")}
    >
      <div className="artwork-grid" />
      <svg className="table-network" viewBox="0 0 560 540" aria-hidden="true">
        <defs>
          <radialGradient id="network-glow">
            <stop stopColor="white" stopOpacity=".12" />
            <stop offset="1" stopColor="white" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="280" cy="260" r="245" fill="url(#network-glow)" />
        <g fill="none" stroke="white" strokeWidth=".6" opacity=".24">
          {Array.from({ length: 9 }, (_, i) => (
            <ellipse key={i} cx="280" cy="260" rx={20 + i * 23} ry="205" />
          ))}
          {Array.from({ length: 9 }, (_, i) => (
            <ellipse
              key={i}
              cx="280"
              cy={98 + i * 40.5}
              rx={Math.sqrt(205 ** 2 - (162 - i * 40.5) ** 2)}
              ry="15"
            />
          ))}
          <circle cx="280" cy="260" r="205" />
        </g>
        <g fill="white">{dots}</g>
        <ellipse
          cx="280"
          cy="260"
          rx="256"
          ry="74"
          fill="none"
          stroke="white"
          strokeOpacity=".5"
          strokeWidth="1"
          transform="rotate(-27 280 260)"
        />
        <circle cx="61" cy="375" r="5" fill="white" />
        <circle cx="493" cy="148" r="4" fill="white" />
      </svg>
      <div className="network-center">
        <QrCode size={53} strokeWidth={1.2} />
        <span>{tr("ONE CONNECTED TABLE")}</span>
      </div>
      <div className="network-label label-scan">
        <span>01</span>
        {tr("Scan")}
        <QrCode size={15} />
      </div>
      <div className="network-label label-order">
        <span>02</span>
        {tr("Order")}
        <Users size={15} />
      </div>
      <div className="network-label label-serve">
        <span>03</span>
        {tr("Serve")}
        <Check size={15} />
      </div>
      <span className="artwork-caption">
        {tr("GUESTS ↔ KITCHEN ↔ SERVICE")}
      </span>
    </div>
  );
}
