# Mock accounts and demo data

The app is branded **orderCup**, using the existing three-stripe icon. **Table & Thyme** is the sample restaurant, not the app name. Mock account credentials and restaurant links remain valid.

The local PostgreSQL database contains exactly **one restaurant: Table & Thyme**, with one controller, one restaurant admin, and one staff account.

## Start the app

From the project directory, run:

```sh
pnpm db:local
pnpm dev
```

The database is already migrated and seeded in this workspace. Open [http://localhost:3000](http://localhost:3000) after the server starts. Use the same hostname consistently when testing so your login cookies stay available.

## Login URLs and credentials

| Account | Login URL | Email | Password |
| --- | --- | --- | --- |
| Controller | [http://localhost:3000/admin](http://localhost:3000/admin) | `controller@tableandthyme.local` | `TableThyme2026!` |
| Restaurant admin | [http://localhost:3000/admin](http://localhost:3000/admin) | `admin@tableandthyme.local` | `TableThyme2026!` |
| Staff | [http://localhost:3000/admin](http://localhost:3000/admin) | `staff@tableandthyme.local` | `TableThyme2026!` |

All team accounts use the single, unlisted `/admin` entry point. The workspace is selected automatically from the signed-in account’s role. `/controller` and `/staff` redirect to `/admin`; neither management nor staff links appear on the public site.

Open `/admin`, enter the email and password, and click **Sign in to your workspace**. In development, the account buttons on the login page fill the credentials for you; click **Sign in** afterward.

- **Controller — Platform controller:** manages restaurant tenants and their accounts and views platform activity. This account has platform access and is not assigned to a restaurant.
- **Admin — Alex Morgan:** belongs to Table & Thyme. Manages its menu items, categories, tables, QR codes, staff accounts, and analytics.
- **Staff — Kitchen team:** belongs to Table & Thyme. Receives orders and payment requests, updates cooking/serving status, closes paid buckets, and toggles dish availability.

Staff and management share one login session per browser profile. Use separate profiles or a private window to test multiple roles simultaneously. These are local development credentials, not production accounts.

## Restaurant

| Detail | Mock value |
| --- | --- |
| Restaurant name | Table & Thyme |
| Restaurant slug | `table-and-thyme` |
| Status | Active |
| Currency | KZT — prices stored in whole tenge |
| Service charge | 10% |
| Tables | 12, numbered 1–12 |
| Categories | 5 |
| Menu items | 12 |

The admin and staff accounts are already linked to this restaurant. No second restaurant is needed to test the app.

## Mock menu

All seeded categories are active, and all seeded dishes are available initially. Each dish includes a description, photo URL, selling price, and internal cost price.

| Category | Item | Price (KZT) | Cost price (KZT) |
| --- | --- | ---: | ---: |
| Burgers | The Thyme Burger | 4,200 | 1,600 |
| Burgers | Crispy Chicken Burger | 3,800 | 1,350 |
| Burgers | The Garden Burger | 3,600 | 1,150 |
| Bowls & salads | Green Goddess Bowl | 3,400 | 1,000 |
| Bowls & salads | Burrata & Tomatoes | 3,900 | 1,700 |
| Bowls & salads | Salmon Harvest Bowl | 4,900 | 2,200 |
| Small plates | Truffle Parmesan Fries | 2,200 | 650 |
| Small plates | Crispy Calamari | 3,200 | 1,300 |
| Drinks | Matcha Cloud | 1,800 | 450 |
| Drinks | House Lemonade | 1,400 | 300 |
| Desserts | Basque Cheesecake | 2,400 | 800 |
| Desserts | Chocolate Brownie | 2,200 | 700 |

Menu prices exclude the service charge, which is added to the confirmed bill. Cost prices are for management analytics and are not shown to guests. Photos are served from Unsplash and require internet access.

## Test guest ordering

1. Open the [guest menu](http://localhost:3000/restaurant?slug=table-and-thyme), choose a dish, and enter a display name. No guest email, password, or registration is required. Opening the restaurant menu without a table parameter uses Table 08. The home page `/` is the product landing page.
2. Click **Share** in the header to open the bucket QR and copy its invite link. Before a bucket exists, Share opens the table-menu QR instead.
3. Open the invite in another browser profile, private window, or phone to join as a different guest.
4. Add items, then use the host's bucket drawer to **Confirm Order**.
5. Sign in as staff to advance the order through **PENDING → COOKING → SERVED**.
6. As the host, open **Orders & bill → Request Payment**, then choose **Pay Together** or **Pay Separately**. Staff receive the request and can mark the bucket paid and closed after serving or cancelling its batches.

For physical table QR codes, sign in as admin and open **Tables & QR codes**. Table links use `/restaurant?slug=table-and-thyme&table=[tableId]` (a table number such as `8` also works). Bucket invites use `/restaurant?slug=table-and-thyme&bucket=[bucketId]`. The IDs are generated in the database; old `/r/.../t/...` and `/b/...` links redirect to the new URLs.

To test on phones, run `pnpm dev --hostname 0.0.0.0` and visit the computer's LAN address instead of `localhost`. Generate the QR from that LAN address so phones can open it.

## Seed behavior

The source of this mock data is [scripts/seed.ts](scripts/seed.ts). For a fresh database, run:

```sh
pnpm db:migrate
pnpm db:seed
```

The seed skips creation when `table-and-thyme` already exists. Running it again does not create duplicate restaurants, reset edited menu data, or reset passwords. A custom `SEED_PASSWORD` changes the initial password only when creating the seed for the first time.

Order history and analytics are generated by actual demo interactions; the seed does not fabricate historical orders or revenue. Local testing may leave guest buckets and analytics records. Nothing in this app processes an online payment.

## Public landing and integration enquiries

The public home page is [http://localhost:3000](http://localhost:3000). Its **Connect your restaurant** form collects the owner’s name, restaurant name, email, optional phone, city, optional table count, and notes. Requests are saved to PostgreSQL. Sign in with the controller account at `/admin` and open **Integration requests** to review the details and mark a request contacted. Submitting this form does not create another restaurant or send an automatic email.

## Languages and mock menu translations

New visitors start in **Қазақша**. Use the globe selector at the top of the landing page, QR/menu entry, `/admin` login, or signed-in workspace to choose **Русский** or **English**. The browser remembers that choice for a year; signing in or out keeps it. The English labels used in the walkthrough above can be shown by choosing **English**.

The mock restaurant still has 5 categories and 12 dishes. Russian is now the stored source language for category names, dish names, and descriptions. All mock categories and dishes also include English translations. Most dishes include Kazakh translations; **Truffle Parmesan Fries, Crispy Calamari, Basque Cheesecake, and Chocolate Brownie** intentionally leave Kazakh blank so you can see Russian fallback while the surrounding UI stays Kazakh.

In `/admin`, open **Menu items** or **Categories**, create/edit an entry, and expand **Optional menu translations**. Russian names are required. Kazakh and English names/descriptions can be left empty, filled, or cleared later; every empty field independently uses its Russian version. The existing prices, tables, accounts, and ordering flow are unchanged.

## Production access

orderCup is deployed at https://ordercup.duckdns.org, with team login at https://ordercup.duckdns.org/admin. The demo restaurant and table 8 are available at:

- https://ordercup.duckdns.org/restaurant?slug=table-and-thyme
- https://ordercup.duckdns.org/restaurant?slug=table-and-thyme&table=8

Production uses the same demo email addresses with a separately generated password. Read the private, git-ignored `production-credentials.md` in this workspace for that password. The `TableThyme2026!` password above applies only to local development. Generate table and invitation QR codes from the production domain when sharing with phones outside your local network.
