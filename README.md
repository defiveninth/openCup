# orderCup

orderCup connects restaurant menus, guest ordering, kitchen service, and management. The three-stripe icon is the orderCup brand mark. The sample restaurant is **Table & Thyme**, a separate demo tenant.

A mobile-first restaurant ordering app built from [tech.md](tech.md). Guests share a table bucket, staff receive live orders and bill requests, managers maintain the restaurant, and a controller manages tenants.

## Run locally

Requirements: Node.js 20.9+, pnpm, and PostgreSQL. The provided local database helper supports Postgres.app on macOS or PostgreSQL binaries on your PATH (`PG_BIN` can override the binary directory).

```sh
pnpm install
cp .env.example .env.local
# Set SESSION_SECRET in .env.local to a random value.
pnpm db:local
pnpm db:migrate
pnpm db:seed
pnpm dev
```

Open [localhost:3000](http://localhost:3000) for the product landing and restaurant integration form. Open [the demo restaurant](http://localhost:3000/restaurant?slug=table-and-thyme) for guest ordering. This workspace already has a local database, migrations, and sample menu configured. The database helper stores its files in ignored `.data/postgres` and listens only on loopback port 5433. It preserves existing data on subsequent runs. To stop it, run `pg_ctl -D .data/postgres stop` using your PostgreSQL binary directory if needed.

Alternatively, run `docker compose up -d` instead of `pnpm db:local`, and use `DATABASE_URL=postgres://postgres:postgres@localhost:5433/table_thyme`. Or point `DATABASE_URL` to an existing PostgreSQL database before applying migrations.

## Development sign-in

The seed creates the following accounts with password **`TableThyme2026!`** (or your `SEED_PASSWORD`). It is idempotent and does not overwrite an existing sample restaurant.

| Workspace | Route | Email |
| --- | --- | --- |
| Kitchen & floor | `/admin` | `staff@tableandthyme.local` |
| Restaurant manager | `/admin` | `admin@tableandthyme.local` |
| Platform controller | `/admin` | `controller@tableandthyme.local` |

All team roles sign in at `/admin`; the signed-in role determines whether the kitchen, manager, or controller workspace is shown. Management links are absent from the public pages. Old `/controller` and `/staff` paths redirect to `/admin`.

Development login pages offer buttons to fill these local credentials. Production hides them. Use private credentials and a unique `SESSION_SECRET` for deployed environments; production seeding requires an explicit `SEED_PASSWORD`.

## Try the experience

1. Open `/restaurant?slug=table-and-thyme`, choose a dish, and enter a display name. This starts a bucket at Table 08. Table QR links use `/restaurant?slug=[restaurantSlug]&table=[tableId]`; a table number also works. Bucket invites use `/restaurant?slug=[restaurantSlug]&bucket=[bucketId]`. Old QR routes redirect to these URLs.
2. Select **Share** in the header to see the bucket QR and invite link. Join that link in a separate browser profile or phone so each guest has their own signed session.
3. Each guest’s menu counters affect only their own unconfirmed items. The shared bucket drawer groups choices by person; the host can edit all current choices.
4. The host confirms a batch. Staff see it on the live board and advance it from pending to cooking to served. Enable the bell to hear order and payment alerts.
5. Order more batches or request a combined/separate bill. Service charges are allocated using whole-unit rounding, and individual shares sum exactly to the grand total. A guest who ordered nothing is never allocated a charge. No online payment processing is involved.
6. Staff mark a bucket paid and closed after all batches have been served or cancelled.
7. Managers can edit categories, dishes, tables, QR codes, and staff accounts. Controllers create restaurants with manager accounts and manage tenant activity and accounts.

For phones, run `pnpm dev --hostname 0.0.0.0`, visit the computer’s LAN address on both devices, and generate QR codes from that address. The QR uses the current browser origin. In production use HTTPS.

## Implementation

- **Next.js App Router / TypeScript**, route handlers for the specified bucket endpoints, and a server action for sign-out.
- **PostgreSQL + Drizzle**, with checked-in SQL migrations, foreign keys, positive-price/quantity checks, unique table numbers, and a partial unique index for unconfirmed participant items.
- **Tailwind CSS**, locally owned shadcn-style Button and Radix Dialog primitives, and Lucide icons. CSS provides the responsive black-and-white design, menu cards/list, accessible dialogs, live board, and print layout.
- **Zustand** applies optimistic counters. Mutations are queued locally and reconciled with server snapshots, including recovery after rejected changes.
- **qrcode.react** generates bucket and table QRs. Table QRs support print and SVG download.
- **SSE** streams database-backed snapshots every 1.5 seconds, with reconnects and heartbeats. Staff events identify new batches, payment requests, and availability changes. Changes are shared across processes because PostgreSQL is the source of truth. This polling implementation is designed for a small installation; use a shared pub/sub transport to reduce database polling at large scale. Deploy on a Node runtime that supports streaming responses and configure proxy streaming accordingly.
- **Signed HttpOnly guest and staff cookies**, persistent guest names/IDs in localStorage, scrypt password hashes, role/tenant checks, same-origin mutations, and login throttling. The login throttle is process-local; use shared rate limiting for a multi-instance public deployment.
- **Atomic transactions** lock the bucket for joins, item changes, confirmation, and payment requests. Prices are captured on first add and preserved in confirmed orders. Confirmed data cannot be edited through cart endpoints. Records with order history are protected from deletion; hide unavailable dishes instead.
- **SQL analytics** measure confirmed revenue (excluding service), batch volume, average party size, spend per guest, demand by weekday/hour, product popularity, gross margin, pre-order removals, and payment modes. Cancellation is excluded from revenue. Removal events describe abandoned choices, not actual food discarded. The demand chart uses Asia/Almaty time. Restaurant currency is respected; platform monetary summaries stay per restaurant when tenants use different currencies.

## Commands & checks

```sh
pnpm db:generate # Generate a migration after schema changes
pnpm db:migrate  # Apply checked-in migrations
pnpm db:seed     # Create sample restaurant and accounts
pnpm lint
pnpm build
pnpm test        # Requires running local app and a seeded database
```

The Playwright test runner uses independent HTTP sessions rather than launching a browser. Integration tests create a uniquely named restaurant, exercise the API/SSE and page routes, and remove only that fixture in teardown. Coverage includes concurrent quantity updates, ownership/host permissions, tenant isolation, availability, price snapshots, batch transitions, exact splitting, closure, CRUD, and authenticated live streams. Set `TEST_BASE_URL` to test another local server. Run against a development/test database.

Sample food photography is loaded from Unsplash and requires internet access. Restaurant managers can provide their own HTTPS image URLs.

## Restaurant integration enquiries

The home page `/` contains one product banner, an owner contact form, and a footer. The form saves restaurant/contact details to `integration_requests` in PostgreSQL without registering another restaurant. The controller can review enquiries and mark them contacted from **Integration requests** in `/admin`. Other roles cannot read or manage these contacts. Follow-up is manual; no email service is invoked.

## Languages

The interface supports **Қазақша (`kk`), Русский (`ru`), and English (`en`)**. A first visit defaults to Kazakh regardless of browser language. The visible globe/language selector appears at the top of the landing page, guest menu/table QR entry, team login, and every signed-in workspace. The preference is saved in a one-year `locale` cookie and used by server rendering, page titles, dates, and currency formatting. Changing languages preserves the current route and form state.

UI messages live in `src/lib/i18n/kk.json` and `ru.json`; the English source phrase is the message key and English fallback. Use `useI18n().t(key, values)` in client components or `serverI18n()` on the server. Keep variable values in named placeholders, and add every new UI phrase to both dictionaries. User-provided names and contact details are displayed as entered.

Menu content has a separate language model: `name` and `description` are the Russian source fields. Categories have optional `nameKk`/`nameEn`; dishes also have optional `descriptionKk`/`descriptionEn`. The manager's item/category editor always labels the Russian source explicitly, with other languages under **Optional menu translations**. Each blank or whitespace-only translated field independently falls back to its Russian field. Clearing a field restores fallback; omitting it from an API update preserves its saved value. Use `menuText()` for display, and retain raw fields when editing.

Apply migration `0004_absurd_sunspot.sql` with `pnpm db:migrate` on existing databases before running this version. It adds nullable translation columns and upgrades the known mock menu to Russian source text, retaining its English text as translations. No extra restaurant is created.

## Production

Live site: **https://ordercup.duckdns.org**. Team login: **https://ordercup.duckdns.org/admin**. The demo restaurant is at https://ordercup.duckdns.org/restaurant?slug=table-and-thyme.

The server runs orderCup in an isolated Docker Compose project with a private PostgreSQL container, persistent storage, resource limits, automatic restarts, and a database-backed `/api/health` endpoint. Its hostname-specific Traefik route uses HTTPS and supports live SSE streams. The pre-existing server applications are separate and were not restarted or reconfigured.

See [deployment operations](deploy/README.md) for release, backup, and rollback commands. Initial production account access is saved separately in the private, git-ignored `production-credentials.md`; the local mock password is not used in production.
