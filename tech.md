# Product & Technical Specification: Collaborative QR Table Ordering & Restaurant Analytics App

## 1. Executive Summary & Goal

Build a mobile-first web application using **Next.js**, **PostgreSQL**, and **Drizzle ORM** for restaurants and their guests.

* **For Guests:** Scan a physical Table QR code to start a "Bucket" (table session), invite friends at the table via an in-app Bucket QR code, add items collaboratively in real time, and confirm order batches or request payment (`Pay Together` or `Pay Separately`). No user registration and no in-app payment processing.
* **For Restaurant Staff & Admins:** Manage menu items/categories, receive real-time table orders and bill requests on a live board, and collect detailed order/behavioral analytics to reduce food waste and optimize costs.
* **For Controller (SuperAdmin):** Monitor all restaurants, active buckets, orders, and platform analytics from a master dashboard.

---

## 2. Strict Tech Stack Requirements

* **Framework:** Next.js (App Router, TypeScript, Server Actions & Route Handlers)
* **Database:** PostgreSQL (`pg` or `@neondatabase/serverless` / `postgres` driver)
* **ORM:** **Drizzle ORM** (`drizzle-orm/pg-core`) + `drizzle-kit` for schema migrations
* **Styling & UI:** Tailwind CSS + shadcn/ui + Lucide Icons
* **Client State Management:** Zustand (for optimistic UI on `- {count} +` item counters)
* **QR Code Generation:** `qrcode.react` (for generating Table QRs and in-app Host Bucket QRs)
* **Real-Time Sync:** Socket.io / Pusher / Server-Sent Events (SSE) for instant bucket updates across multiple phones at the same table and live staff notifications

---

## 3. User Roles & Permissions

### Role 1: Client (Guest)
* **Authentication:** None. Enters display name on first visit. System generates a persistent `guestUuid` saved in `localStorage` and cookies so page refreshes keep the user in their bucket.
* **Bucket Creation & Joining:**
  * Scans Table QR (`/r/[restaurantSlug]/t/[tableId]`).
  * Can choose **"Create New Bucket"** (becomes the **Bucket Host**) or join an existing bucket by scanning the **Host's In-App Bucket QR Code** (`/b/[bucketId]`).
* **Menu Browsing:**
  * Top sticky horizontal category slider (`Burgers`, `Drinks`, `Desserts`, etc.).
  * Toggle view mode between **Card View** (grid with large photos) and **List View** (compact horizontal rows).
* **Adding & Controlling Items:**
  * Each menu item has an `Add` button. Clicking `Add` transforms the button into `- {count} +`.
  * **Strict Ownership Rule:** On the menu screen, `- {count} +` only increments/decrements **that specific user's own items**.
  * If other friends in the bucket have also added the same item, show a small badge on the card: `Table total: X`.
* **Bucket Drawer & Host Powers:**
  * Shows all unconfirmed items grouped by participant name, plus previously confirmed batches.
  * Regular guests can only modify/delete their own unconfirmed items.
  * **Host Only:** Can increment, decrement, or remove **anyone's** unconfirmed items inside the Bucket Drawer.
  * **Host Only:** Clicks **"Confirm Order"** to send current unconfirmed items as a batch to the restaurant staff. The bucket remains open so the table can order more items later.
  * **Host Only:** Clicks **"Request Payment"**, which opens a modal with two buttons:
    1. `Pay Together` (Shows grand total and alerts waiter).
    2. `Pay Separately` (Calculates and displays exact total owed per participant and alerts waiter).

### Role 2: Staff (Waiter / Kitchen)
* **Authentication:** Simple PIN or Staff credentials login (`/staff`).
* **Live Order & Table Board:**
  * Real-time kanban/list view of incoming `order_batches` with audio notification.
  * Update batch status: `PENDING` -> `COOKING` -> `SERVED`.
  * Receive instant alerts when a Host clicks `Request Payment` (clearly showing whether the table chose `Pay Together` or `Pay Separately` with per-guest breakdown).
  * Ability to mark a table's Bucket as `CLOSED` once paid.
  * **Quick Availability Toggle:** 1-click switch to temporarily disable/enable a menu item that ran out in the kitchen.

### Role 3: Admin (Restaurant Manager)
* **Authentication:** Email/Password login (`/admin`).
* **Menu & Table Management:**
  * Full CRUD for Categories (name, sort order, active toggle).
  * Full CRUD for Menu Items (name, description, price, cost price, photo URL, category, availability toggle).
  * CRUD for Tables + automatic printable Table QR code generator.
* **Restaurant Analytics Dashboard:**
  * Track total orders, revenue, average party size per bucket, peak ordering hours, most ordered items, and items removed by Hosts before ordering (to help optimize menu pricing and fight food waste).

### Role 4: Controller (Platform SuperAdmin)
* **Authentication:** Master credentials login (`/controller`).
* **Global Dashboard:**
  * Create/manage Restaurant tenants and their Admin accounts.
  * Monitor global platform activity (active buckets, total orders, restaurant performance, global food-waste/demand analytics).

---

## 4. Core User Flows & Screen Specifications

### Screen A: Table Landing (`src/app/r/[restaurantSlug]/t/[tableId]/page.tsx`)
1. Prompt user for their `Name` if `guestUuid` / `guestName` is not already in `localStorage`.
2. Show main action: **"Create New Bucket"** (creates a `buckets` record in PostgreSQL via Drizzle, sets current user as `isHost = true` in `bucket_participants`, and redirects to `/b/[bucketId]`).
3. Inform secondary guests: *"Joining a friend's bucket? Scan the QR code on their phone screen."*

### Screen B: Active Bucket & Menu (`src/app/b/[bucketId]/page.tsx`)
1. **If joining via Host's Bucket QR:** If user doesn't have a `guestName` yet, prompt for `Name`, insert them into `bucket_participants`, and load the menu.
2. **Header Bar:**
   * Restaurant Name & Table Number.
   * **"Show Bucket QR" button:** Opens a modal displaying a scannable QR code for `https://[domain]/b/[bucketId]` and lists current participants at the table.
   * **View Toggle Icon:** Switches item list between `Grid Card View` and `Compact List View`.
3. **Category Slider (Sticky Top):**
   * Horizontal scrollable pills for all active categories. Clicking a category scrolls smoothly to or filters that category.
4. **Menu Item Card / Row:**
   * Displays Image, Title, Description, Price.
   * Action Button:
     * If user's personal count is `0`: Show `Add` button.
     * If user's personal count is `> 0`: Show `- {myCount} +` selector.
     * If total table count (across all participants) is `> 0`: Show subtle badge `In bucket: {tableCount}`.
5. **Bottom Floating Bar & Bucket Drawer:**
   * Floating bar shows total unconfirmed items in bucket and total price.
   * Clicking opens the **Bucket Drawer** with two tabs:
     * **Tab 1: Current Unconfirmed Cart** (Grouped by Participant Name). Host has `- / + / Delete` controls on all participants' items; guests only on their own.
       * Bottom button for Host: **"Confirm Order"** (moves items into a new `order_batches` record and notifies Staff).
     * **Tab 2: Ordered History & Bill** (Shows confirmed batches, their live status `PENDING / COOKING / SERVED`, and a breakdown of cost per person).
       * Bottom button for Host: **"Request Payment"** -> Opens modal with two big buttons: **`Pay Together`** and **`Pay Separately`**.

---

## 5. Database Schema (PostgreSQL + Drizzle ORM)

File path: `src/db/schema.ts`

```typescript
import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  real,
  pgEnum,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const roleEnum = pgEnum("role", ["CONTROLLER", "ADMIN", "STAFF"]);
export const bucketStatusEnum = pgEnum("bucket_status", [
  "OPEN",
  "PAYMENT_REQUESTED",
  "CLOSED",
]);
export const paymentModeEnum = pgEnum("payment_mode", ["TOGETHER", "SEPARATE"]);
export const batchStatusEnum = pgEnum("batch_status", [
  "PENDING",
  "COOKING",
  "SERVED",
  "CANCELLED",
]);
export const analyticsEventTypeEnum = pgEnum("analytics_event_type", [
  "ITEM_ADDED",
  "ITEM_REMOVED_BY_USER",
  "ITEM_REMOVED_BY_HOST",
  "BATCH_CONFIRMED",
  "PAYMENT_REQUESTED",
]);

// 1. Restaurants
export const restaurants = pgTable("restaurants", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  currency: text("currency").default("KZT").notNull(),
  serviceChargePct: real("service_charge_pct").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 2. Users (Controller, Restaurant Admin, Staff)
export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  restaurantId: uuid("restaurant_id").references(() => restaurants.id, {
    onDelete: "cascade",
  }), // Null for CONTROLLER role
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 3. Tables
export const tables = pgTable("tables", {
  id: uuid("id").defaultRandom().primaryKey(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  number: integer("number").notNull(),
});

// 4. Categories
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// 5. Menu Items
export const menuItems = pgTable("menu_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  categoryId: uuid("category_id")
    .notNull()
    .references(() => categories.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  price: integer("price").notNull(), // Stored in whole units (e.g. KZT) or cents
  costPrice: integer("cost_price"), // For food-waste & profit margin analytics
  isAvailable: boolean("is_available").default(true).notNull(),
});

// 6. Buckets (Table Sessions)
export const buckets = pgTable("buckets", {
  id: uuid("id").defaultRandom().primaryKey(), // Used in Host Bucket QR (/b/[bucketId])
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  tableId: uuid("table_id")
    .notNull()
    .references(() => tables.id, { onDelete: "cascade" }),
  hostGuestId: text("host_guest_id").notNull(), // guestUuid of creator
  status: bucketStatusEnum("status").default("OPEN").notNull(),
  paymentMode: paymentModeEnum("payment_mode"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  closedAt: timestamp("closed_at"),
});

// 7. Bucket Participants
export const bucketParticipants = pgTable(
  "bucket_participants",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bucketId: uuid("bucket_id")
      .notNull()
      .references(() => buckets.id, { onDelete: "cascade" }),
    guestUuid: text("guest_uuid").notNull(),
    displayName: text("display_name").notNull(),
    isHost: boolean("is_host").default(false).notNull(),
    joinedAt: timestamp("joined_at").defaultNow().notNull(),
  },
  (table) => ({
    bucketGuestUnique: uniqueIndex("bucket_guest_unique_idx").on(
      table.bucketId,
      table.guestUuid
    ),
  })
);

// 8. Order Batches
export const orderBatches = pgTable("order_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  bucketId: uuid("bucket_id")
    .notNull()
    .references(() => buckets.id, { onDelete: "cascade" }),
  batchNumber: integer("batch_number").notNull(),
  status: batchStatusEnum("status").default("PENDING").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  servedAt: timestamp("served_at"),
});

// 9. Bucket Items
export const bucketItems = pgTable("bucket_items", {
  id: uuid("id").defaultRandom().primaryKey(),
  bucketId: uuid("bucket_id")
    .notNull()
    .references(() => buckets.id, { onDelete: "cascade" }),
  participantId: uuid("participant_id")
    .notNull()
    .references(() => bucketParticipants.id, { onDelete: "cascade" }),
  menuItemId: uuid("menu_item_id")
    .notNull()
    .references(() => menuItems.id, { onDelete: "cascade" }),
  batchId: uuid("batch_id").references(() => orderBatches.id, {
    onDelete: "set null",
  }), // Null = unconfirmed in bucket; Populated = confirmed in an OrderBatch
  quantity: integer("quantity").notNull(),
  unitPrice: integer("unit_price").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// 10. Analytics Events
export const analyticsEvents = pgTable("analytics_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  bucketId: uuid("bucket_id"),
  guestUuid: text("guest_uuid"),
  menuItemId: uuid("menu_item_id"),
  eventType: analyticsEventTypeEnum("event_type").notNull(),
  quantity: integer("quantity"),
  partySize: integer("party_size"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Drizzle Relations
export const bucketsRelations = relations(buckets, ({ one, many }) => ({
  restaurant: one(restaurants, {
    fields: [buckets.restaurantId],
    references: [restaurants.id],
  }),
  table: one(tables, {
    fields: [buckets.tableId],
    references: [tables.id],
  }),
  participants: many(bucketParticipants),
  batches: many(orderBatches),
  items: many(bucketItems),
}));

export const bucketParticipantsRelations = relations(
  bucketParticipants,
  ({ one, many }) => ({
    bucket: one(buckets, {
      fields: [bucketParticipants.bucketId],
      references: [buckets.id],
    }),
    items: many(bucketItems),
  })
);

export const bucketItemsRelations = relations(bucketItems, ({ one }) => ({
  bucket: one(buckets, {
    fields: [bucketItems.bucketId],
    references: [buckets.id],
  }),
  participant: one(bucketParticipants, {
    fields: [bucketItems.participantId],
    references: [bucketParticipants.id],
  }),
  menuItem: one(menuItems, {
    fields: [bucketItems.menuItemId],
    references: [menuItems.id],
  }),
  batch: one(orderBatches, {
    fields: [bucketItems.batchId],
    references: [orderBatches.id],
  }),
}));
```

---

## 6. Next.js API Routes / Server Actions & Real-Time Specification

### Key Endpoints / Server Actions
1. `POST /api/buckets/create` -> Inserts a new `buckets` row and registers the creator in `bucket_participants` (`isHost: true`).
2. `POST /api/buckets/[bucketId]/join` -> Upserts a guest (`guestUuid`, `displayName`) into `bucket_participants`.
3. `POST /api/buckets/[bucketId]/items` -> Mutates item quantity (`+1`, `-1`, or delete) in `bucket_items` where `batchId IS NULL`.
   * **Validation:** Check if `actorGuestUuid === targetParticipant.guestUuid` OR `actorGuestUuid === bucket.hostGuestId`. If neither, return `403 Forbidden`.
   * Insert log into `analytics_events` (specifically flagging `ITEM_REMOVED_BY_HOST` if Host decrements/removes another participant's item).
4. `POST /api/buckets/[bucketId]/confirm` -> Verifies requester is Host, inserts a new `order_batches` record, updates all `bucket_items` where `batchId IS NULL` to point to the new `batchId`, and emits a real-time alert to the Staff dashboard.
5. `POST /api/buckets/[bucketId]/request-payment` -> Verifies requester is Host, updates `buckets.status = 'PAYMENT_REQUESTED'` and `buckets.paymentMode = 'TOGETHER' | 'SEPARATE'`, and alerts Staff dashboard.

### Real-Time Channels / Events
* **Room `bucket:[bucketId]`:**
  * `bucket:updated` -> Broadcast whenever a participant joins, an item count changes, a batch is confirmed, or payment mode is selected.
* **Room `restaurant:[restaurantId]:staff`:**
  * `order:new_batch` -> Broadcast when a Host confirms an order batch.
  * `table:payment_requested` -> Broadcast when a Host selects `Pay Together` or `Pay Separately`.
  * `menu:item_toggled` -> Broadcast when Staff/Admin disables or enables an item.

---

## 7. Analytics & Data Collection Requirements (Drizzle Aggregations)

Every order and bucket interaction must populate `analytics_events` and SQL aggregation queries in Drizzle (`sql`, `count`, `sum`, `avg`) for the Admin & Controller dashboards:

1. **Order Volume by Time & Day:** Heatmap of when products are ordered (`EXTRACT(DOW FROM created_at)` and `EXTRACT(HOUR FROM created_at)`) to forecast kitchen prep quantities and prevent food waste.
2. **Product Performance:** Top ordered items, least ordered items, and **Abandoned/Vetoed Items** (items added to buckets by guests but removed by the user or Host before confirmation).
3. **Party Size & Check Metrics:** Average number of guests (`bucket_participants` count) per bucket, average spend per person, and ratio of `Pay Together` vs. `Pay Separately`.