import { redirect } from "next/navigation";
import { restaurantUrl } from "@/lib/restaurant-url";
export default async function Page({
  params,
}: {
  params: Promise<{ restaurantSlug: string; tableId: string }>;
}) {
  const { restaurantSlug, tableId } = await params;
  redirect(restaurantUrl(restaurantSlug, { table: tableId }));
}
