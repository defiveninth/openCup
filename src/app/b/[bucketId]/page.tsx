import { db } from "@/db";
import { buckets, restaurants } from "@/db/schema";
import { eq } from "drizzle-orm";
import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { restaurantUrl } from "@/lib/restaurant-url";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ bucketId: string }>;
}) {
  const { bucketId } = await params;
  if (!z.string().uuid().safeParse(bucketId).success) notFound();
  const [row] = await db
    .select({ slug: restaurants.slug })
    .from(buckets)
    .innerJoin(restaurants, eq(restaurants.id, buckets.restaurantId))
    .where(eq(buckets.id, bucketId));
  if (!row) notFound();
  redirect(restaurantUrl(row.slug, { bucket: bucketId }));
}
