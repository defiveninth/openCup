import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db } from "@/db";
import * as s from "@/db/schema";
import type { Analytics, Bucket, Catalog } from "./types";

export async function catalog(
  slug: string,
  privateView = false,
): Promise<Catalog> {
  const restaurant = (
    await db
      .select()
      .from(s.restaurants)
      .where(
        and(
          eq(s.restaurants.slug, slug),
          privateView ? undefined : eq(s.restaurants.isActive, true),
        ),
      )
  )[0];
  if (!restaurant) throw new Error("Restaurant not found");
  const [categories, menu, tables] = await Promise.all([
    db
      .select()
      .from(s.categories)
      .where(eq(s.categories.restaurantId, restaurant.id))
      .orderBy(asc(s.categories.sortOrder)),
    db
      .select()
      .from(s.menuItems)
      .where(eq(s.menuItems.restaurantId, restaurant.id))
      .orderBy(asc(s.menuItems.name)),
    db
      .select({ id: s.tables.id, number: s.tables.number })
      .from(s.tables)
      .where(eq(s.tables.restaurantId, restaurant.id))
      .orderBy(asc(s.tables.number)),
  ]);
  menu.sort(
    (a, b) =>
      (categories.find((c) => c.id === a.categoryId)?.sortOrder ?? 0) -
      (categories.find((c) => c.id === b.categoryId)?.sortOrder ?? 0),
  );
  return {
    restaurant,
    categories: privateView ? categories : categories.filter((c) => c.isActive),
    menu: privateView
      ? menu
      : menu
          .filter((m) =>
            categories.some((c) => c.id === m.categoryId && c.isActive),
          )
          .map((m) => ({ ...m, costPrice: undefined })),
    tables,
  };
}
export async function getBucket(id: string): Promise<Bucket | null> {
  const row = (
    await db
      .select({ bucket: s.buckets, tableNumber: s.tables.number })
      .from(s.buckets)
      .innerJoin(s.tables, eq(s.buckets.tableId, s.tables.id))
      .where(eq(s.buckets.id, id))
  )[0];
  if (!row) return null;
  const [participants, items, batches] = await Promise.all([
    db
      .select()
      .from(s.bucketParticipants)
      .where(eq(s.bucketParticipants.bucketId, id))
      .orderBy(asc(s.bucketParticipants.joinedAt)),
    db.select().from(s.bucketItems).where(eq(s.bucketItems.bucketId, id)),
    db
      .select()
      .from(s.orderBatches)
      .where(eq(s.orderBatches.bucketId, id))
      .orderBy(asc(s.orderBatches.batchNumber)),
  ]);
  return {
    ...row.bucket,
    tableNumber: row.tableNumber,
    participants,
    items,
    batches: batches.map((b) => ({
      ...b,
      createdAt: b.createdAt.toISOString(),
    })),
  };
}
export async function analytics(restaurantId?: string): Promise<Analytics> {
  const scope = restaurantId
    ? sql`and b.restaurant_id = ${restaurantId}`
    : sql``;
  const eventScope = restaurantId
    ? sql`where restaurant_id = ${restaurantId}`
    : sql``;
  const [metrics, products, hours] = await Promise.all([
    db.execute(sql`select
      (select coalesce(sum(i.quantity * i.unit_price),0) from bucket_items i join order_batches ob on ob.id=i.batch_id join buckets b on b.id=i.bucket_id where ob.status != 'CANCELLED' ${scope}) as revenue,
      (select count(*) from order_batches ob join buckets b on b.id=ob.bucket_id where ob.status != 'CANCELLED' ${scope}) as orders,
      (select coalesce(avg(n),0) from (select count(p.id) as n from buckets b left join bucket_participants p on p.bucket_id=b.id where true ${scope} group by b.id) parties) as avg_party,
      (select count(*) from buckets b where status != 'CLOSED' ${scope}) as active,
      (select count(*) from buckets b where payment_mode='TOGETHER' ${scope}) as together,
      (select count(*) from buckets b where payment_mode='SEPARATE' ${scope}) as separate,
      (select count(*) from bucket_participants p join buckets b on b.id=p.bucket_id where true ${scope}) as people`),
    db.execute(sql`select m.id,m.name,m.cost_price,r.currency,
      coalesce((select sum(i.quantity) from bucket_items i join order_batches ob on ob.id=i.batch_id where i.menu_item_id=m.id and ob.status!='CANCELLED'),0) as ordered,
      coalesce((select sum(i.quantity*i.unit_price) from bucket_items i join order_batches ob on ob.id=i.batch_id where i.menu_item_id=m.id and ob.status!='CANCELLED'),0) as revenue,
      coalesce((select sum(e.quantity) from analytics_events e where e.menu_item_id=m.id and e.event_type in ('ITEM_REMOVED_BY_USER','ITEM_REMOVED_BY_HOST')),0) as removed,
      coalesce((select sum(e.quantity) from analytics_events e where e.menu_item_id=m.id and e.event_type='ITEM_REMOVED_BY_HOST'),0) as host_removed
      from menu_items m join restaurants r on r.id=m.restaurant_id ${restaurantId ? sql`where m.restaurant_id=${restaurantId}` : sql``} order by ordered desc`),
    db.execute(
      sql`select extract(dow from created_at at time zone 'Asia/Almaty')::int as day, extract(hour from created_at at time zone 'Asia/Almaty')::int as hour, count(*)::int as count from analytics_events ${eventScope} ${restaurantId ? sql`and` : sql`where`} event_type='BATCH_CONFIRMED' group by 1,2`,
    ),
  ]);
  const m = metrics[0];
  return {
    revenue: Number(m.revenue),
    orders: Number(m.orders),
    avgParty: Number(m.avg_party),
    avgSpend: Number(m.people) ? Number(m.revenue) / Number(m.people) : 0,
    active: Number(m.active),
    together: Number(m.together),
    separate: Number(m.separate),
    products: products.map((p) => ({
      id: String(p.id),
      name: String(p.name),
      ordered: Number(p.ordered),
      revenue: Number(p.revenue),
      removed: Number(p.removed),
      hostRemoved: Number(p.host_removed),
      cost: Number(p.cost_price ?? 0) * Number(p.ordered),
      currency: String(p.currency),
    })),
    hours: hours.map((h) => ({
      day: Number(h.day),
      hour: Number(h.hour),
      count: Number(h.count),
    })),
  };
}
export async function workspace(user: {
  id: string;
  name: string;
  role: string;
  restaurantId: string | null;
}) {
  const restaurants = await db
    .select()
    .from(s.restaurants)
    .where(
      user.role === "CONTROLLER"
        ? undefined
        : eq(s.restaurants.id, user.restaurantId!),
    );
  const ids = restaurants.map((r) => r.id);
  const rows = ids.length
    ? await db
        .select({ id: s.buckets.id })
        .from(s.buckets)
        .where(inArray(s.buckets.restaurantId, ids))
    : [];
  const accounts =
    user.role !== "STAFF" && ids.length
      ? await db
          .select({
            id: s.users.id,
            restaurantId: s.users.restaurantId,
            name: s.users.name,
            email: s.users.email,
            role: s.users.role,
          })
          .from(s.users)
          .where(inArray(s.users.restaurantId, ids))
      : [];
  return {
    user,
    restaurants,
    accounts,
    integrationRequests:
      user.role === "CONTROLLER"
        ? (
            await db
              .select()
              .from(s.integrationRequests)
              .orderBy(desc(s.integrationRequests.createdAt))
          ).map((r) => ({ ...r, createdAt: r.createdAt.toISOString() }))
        : [],
    catalogs: await Promise.all(restaurants.map((r) => catalog(r.slug, true))),
    buckets: (await Promise.all(rows.map((b) => getBucket(b.id)))).filter(
      (b) => b !== null,
    ),
    analytics: await analytics(
      user.role === "CONTROLLER" ? undefined : user.restaurantId!,
    ),
  };
}
