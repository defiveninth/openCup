import mockMenu from "../src/lib/i18n/mock-menu.json";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
async function seed() {
  const { db } = await import("../src/db");
  const s = await import("../src/db/schema");
  const { hashPassword } = await import("../src/lib/auth");
  const { eq } = await import("drizzle-orm");
  const existing = await db
    .select()
    .from(s.restaurants)
    .where(eq(s.restaurants.slug, "table-and-thyme"));
  if (existing.length) {
    console.log("Seed already exists; no data changed.");
    return;
  }
  if (process.env.NODE_ENV === "production" && !process.env.SEED_PASSWORD)
    throw new Error("Set SEED_PASSWORD for production seeding.");
  const password = process.env.SEED_PASSWORD ?? "TableThyme2026!";
  await db.transaction(async (tx) => {
    const [r] = await tx
      .insert(s.restaurants)
      .values({
        name: "Table & Thyme",
        slug: "table-and-thyme",
        currency: "KZT",
        serviceChargePct: 10,
      })
      .returning();
    await tx.insert(s.users).values([
      {
        name: "Alex Morgan",
        email: "admin@tableandthyme.local",
        passwordHash: hashPassword(password),
        role: "ADMIN",
        restaurantId: r.id,
      },
      {
        name: "Kitchen team",
        email: "staff@tableandthyme.local",
        passwordHash: hashPassword(password),
        role: "STAFF",
        restaurantId: r.id,
      },
      {
        name: "Platform controller",
        email: "controller@tableandthyme.local",
        passwordHash: hashPassword(password),
        role: "CONTROLLER",
      },
    ]);
    await tx.insert(s.tables).values(
      Array.from({ length: 12 }, (_, i) => ({
        restaurantId: r.id,
        number: i + 1,
      })),
    );
    const cats = await tx
      .insert(s.categories)
      .values(
        ["Burgers", "Bowls & salads", "Small plates", "Drinks", "Desserts"].map(
          (name, i) => ({
            name: (mockMenu as Record<string, string[]>)[name][0],
            nameKk: (mockMenu as Record<string, string[]>)[name][1],
            nameEn: name,
            restaurantId: r.id,
            sortOrder: i,
          }),
        ),
      )
      .returning();
    const items = [
      [
        0,
        "The Thyme Burger",
        "Flame-grilled beef, aged cheddar, caramelized onions & our house thyme sauce.",
        4200,
        1600,
        "photo-1568901346375-23c9450c58cd",
      ],
      [
        0,
        "Crispy Chicken Burger",
        "Buttermilk chicken, crunchy slaw, pickles & a little hot honey.",
        3800,
        1350,
        "photo-1606755962773-d324e0a13086",
      ],
      [
        0,
        "The Garden Burger",
        "Our house chickpea patty, creamy avocado, fresh greens & herb mayo.",
        3600,
        1150,
        "photo-1520072959219-c595dc870360",
      ],
      [
        1,
        "Green Goddess Bowl",
        "Seasonal greens, avocado, cucumber, quinoa & green goddess dressing.",
        3400,
        1000,
        "photo-1512621776951-a57141f2eefd",
      ],
      [
        1,
        "Burrata & Tomatoes",
        "Creamy burrata, sun-ripened tomatoes, basil oil & sourdough.",
        3900,
        1700,
        "photo-1608897013039-887f21d8c804",
      ],
      [
        1,
        "Salmon Harvest Bowl",
        "Roasted salmon, brown rice, avocado, edamame & citrus dressing.",
        4900,
        2200,
        "photo-1467003909585-2f8a72700288",
      ],
      [
        2,
        "Truffle Parmesan Fries",
        "Golden hand-cut fries, truffle oil, parmesan & fresh parsley.",
        2200,
        650,
        "photo-1573080496219-bb080dd4f877",
      ],
      [
        2,
        "Crispy Calamari",
        "Tender calamari, lemon, sea salt & a bright garlic aioli.",
        3200,
        1300,
        "photo-1599487488170-d11ec9c172f0",
      ],
      [
        3,
        "Matcha Cloud",
        "Ceremonial matcha, oat milk & a light vanilla cold foam. Served iced.",
        1800,
        450,
        "photo-1515823064-d6e0c04616a7",
      ],
      [
        3,
        "House Lemonade",
        "Fresh lemons, rosemary, a touch of honey & sparkling water.",
        1400,
        300,
        "photo-1513558161293-cdaf765edfd7",
      ],
      [
        4,
        "Basque Cheesecake",
        "Caramelized on top, impossibly creamy inside. Served with berry compote.",
        2400,
        800,
        "photo-1533134242443-d4fd215305ad",
      ],
      [
        4,
        "Chocolate Brownie",
        "Warm dark chocolate brownie, vanilla bean ice cream & sea salt.",
        2200,
        700,
        "photo-1606313564200-e75d5e30476c",
      ],
    ] as const;
    await tx.insert(s.menuItems).values(
      items.map(([c, name, description, price, costPrice, photo]) => ({
        restaurantId: r.id,
        categoryId: cats[c].id,
        name: (mockMenu as Record<string, string[]>)[name][0],
        nameKk: (mockMenu as Record<string, string[]>)[name][1],
        nameEn: name,
        description: (mockMenu as Record<string, string[]>)[name][2],
        descriptionKk: (mockMenu as Record<string, string[]>)[name][3],
        descriptionEn: description,
        price,
        costPrice,
        imageUrl: `https://images.unsplash.com/${photo}?auto=format&fit=crop&w=1000&q=85`,
      })),
    );
  });
  console.log(
    "Seeded Table & Thyme: 12 tables, 12 dishes, staff/admin/controller accounts. See README for local credentials.",
  );
}
seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
