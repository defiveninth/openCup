import { GuestApp } from "@/components/guest-app";
import { catalog } from "@/lib/data";
import { db } from "@/db";
import { buckets } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { notFound } from "next/navigation";
import { z } from "zod";
export const dynamic = "force-dynamic";
export default async function RestaurantPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const parsed = z
    .object({
      slug: z
        .string()
        .regex(/^[a-z0-9-]+$/)
        .max(80),
      table: z.string().max(40).optional(),
      bucket: z.string().uuid().optional(),
    })
    .safeParse(await searchParams);
  if (!parsed.success) notFound();
  const { slug, table, bucket } = parsed.data;
  const data = await catalog(slug).catch(() => null);
  if (!data) notFound();
  let tableId: string | undefined;
  if (bucket) {
    const [session] = await db
      .select({ tableId: buckets.tableId })
      .from(buckets)
      .where(
        and(
          eq(buckets.id, bucket),
          eq(buckets.restaurantId, data.restaurant.id),
        ),
      );
    if (!session) notFound();
    tableId = session.tableId;
  } else if (table) {
    const selected = data.tables.find(
      (t) => t.id === table || String(t.number) === table,
    );
    if (!selected) notFound();
    tableId = selected.id;
  }
  return (
    <GuestApp
      key={`${data.restaurant.id}:${bucket ?? tableId ?? "menu"}`}
      catalog={data}
      bucketId={bucket}
      tableId={tableId}
      landing={!!tableId && !bucket}
    />
  );
}
