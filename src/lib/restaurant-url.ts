export function restaurantUrl(
  slug: string,
  options: { table?: string | number; bucket?: string } = {},
) {
  const query = new URLSearchParams({ slug });
  if (options.table !== undefined) query.set("table", String(options.table));
  if (options.bucket) query.set("bucket", options.bucket);
  return `/restaurant?${query.toString()}`;
}
