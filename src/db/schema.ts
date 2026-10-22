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
  index,
  check,
} from "drizzle-orm/pg-core";
import { relations, sql } from "drizzle-orm";

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
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

// 3. Tables
export const tables = pgTable(
  "tables",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    number: integer("number").notNull(),
  },
  (table) => [
    uniqueIndex("restaurant_table_number_idx").on(
      table.restaurantId,
      table.number,
    ),
    check("positive_table_number", sql`${table.number}>0`),
  ],
);

// 4. Categories
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  restaurantId: uuid("restaurant_id")
    .notNull()
    .references(() => restaurants.id, { onDelete: "cascade" }),
  name: text("name").notNull(), // Required Russian source text
  nameKk: text("name_kk"),
  nameEn: text("name_en"),
  sortOrder: integer("sort_order").default(0).notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

// 5. Menu Items
export const menuItems = pgTable(
  "menu_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantId: uuid("restaurant_id")
      .notNull()
      .references(() => restaurants.id, { onDelete: "cascade" }),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // Required Russian source text
    nameKk: text("name_kk"),
    nameEn: text("name_en"),
    description: text("description"), // Russian source text
    descriptionKk: text("description_kk"),
    descriptionEn: text("description_en"),
    imageUrl: text("image_url"),
    price: integer("price").notNull(), // Stored in whole units (e.g. KZT) or cents
    costPrice: integer("cost_price"), // For food-waste & profit margin analytics
    isAvailable: boolean("is_available").default(true).notNull(),
  },
  (table) => [
    index("menu_restaurant_idx").on(table.restaurantId),
    check("nonnegative_price", sql`${table.price}>=0`),
    check("nonnegative_cost_price", sql`${table.costPrice}>=0`),
  ],
);

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
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  closedAt: timestamp("closed_at", { withTimezone: true }),
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
    joinedAt: timestamp("joined_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => ({
    bucketGuestUnique: uniqueIndex("bucket_guest_unique_idx").on(
      table.bucketId,
      table.guestUuid,
    ),
  }),
);

// 8. Order Batches
export const orderBatches = pgTable(
  "order_batches",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bucketId: uuid("bucket_id")
      .notNull()
      .references(() => buckets.id, { onDelete: "cascade" }),
    batchNumber: integer("batch_number").notNull(),
    status: batchStatusEnum("status").default("PENDING").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    servedAt: timestamp("served_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("bucket_batch_number_idx").on(
      table.bucketId,
      table.batchNumber,
    ),
  ],
);

// 9. Bucket Items
export const bucketItems = pgTable(
  "bucket_items",
  {
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("unconfirmed_participant_item_idx")
      .on(table.bucketId, table.participantId, table.menuItemId)
      .where(sql`${table.batchId} is null`),
    index("bucket_items_bucket_idx").on(table.bucketId),
    check("positive_quantity", sql`${table.quantity}>0`),
    check("nonnegative_unit_price", sql`${table.unitPrice}>=0`),
  ],
);

// 10. Analytics Events
export const analyticsEvents = pgTable(
  "analytics_events",
  {
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
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("events_restaurant_time_idx").on(table.restaurantId, table.createdAt),
    index("events_menu_item_idx").on(table.menuItemId),
  ],
);

// Restaurant owners requesting an integration; submitting does not create a tenant.
export const integrationRequests = pgTable(
  "integration_requests",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    restaurantName: text("restaurant_name").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    phone: text("phone"),
    city: text("city").notNull(),
    tableCount: integer("table_count"),
    notes: text("notes"),
    status: text("status").default("NEW").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("integration_requests_created_idx").on(table.createdAt),
    check(
      "integration_request_status",
      sql`${table.status} in ('NEW','CONTACTED')`,
    ),
    check("integration_request_tables", sql`${table.tableCount}>0`),
  ],
);

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
  }),
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
