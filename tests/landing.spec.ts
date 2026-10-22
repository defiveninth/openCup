import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import { restaurantUrl } from "../src/lib/restaurant-url";
import type { Workspace, Catalog } from "../src/lib/types";
loadEnvConfig(process.cwd());
const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let visitor: APIRequestContext,
  controller: APIRequestContext,
  admin: APIRequestContext,
  staff: APIRequestContext;
const email = `integration-${Date.now()}@test.local`;
const lead = {
  restaurantName: "Landing Integration Test",
  contactName: "Test owner",
  email,
  phone: "+7 700 000 00 00",
  city: "Almaty",
  tableCount: 18,
  notes: "A neighborhood café interested in collaborative ordering.",
  website: "",
};
test.beforeAll(async () => {
  [visitor, controller, admin, staff] = await Promise.all(
    Array.from({ length: 4 }, () =>
      request.newContext({
        baseURL,
        extraHTTPHeaders: { origin: baseURL },
        storageState: {
          cookies: [
            {
              name: "locale",
              value: "en",
              domain: new URL(baseURL).hostname,
              path: "/",
              expires: -1,
              httpOnly: false,
              secure: false,
              sameSite: "Lax",
            },
          ],
          origins: [],
        },
      }),
    ),
  );
  for (const [ctx, role] of [
    [controller, "controller"],
    [admin, "admin"],
    [staff, "staff"],
  ] as const) {
    const result = await ctx.post("/api/auth/login", {
      data: {
        email: `${role}@tableandthyme.local`,
        password: process.env.SEED_PASSWORD ?? "TableThyme2026!",
      },
    });
    expect(result.status()).toBe(200);
  }
});
test.afterAll(async () => {
  const postgres = (await import("postgres")).default;
  const sql = postgres(
    process.env.DATABASE_URL ?? "postgres://localhost:5433/table_thyme",
  );
  await sql`delete from integration_requests where email=${email} and restaurant_name=${lead.restaurantName}`;
  await sql.end();
  await Promise.all(
    [visitor, controller, admin, staff]
      .filter(Boolean)
      .map((ctx) => ctx.dispose()),
  );
});
test("public home is the short product landing and restaurants use explicit links", async () => {
  const home = await visitor.get("/");
  expect(home.status()).toBe(200);
  const html = await home.text();
  expect(html).toContain("A better table.");
  expect(html).toContain("Connect your restaurant");
  expect(html).toContain('name="restaurantName"');
  expect(html).not.toContain('href="/admin"');
  expect(html).not.toContain('href="/controller"');
  expect(html).not.toContain('href="/staff"');
  expect(html).not.toContain("Crispy Chicken Burger");
  const menu = await visitor.get(restaurantUrl("table-and-thyme"));
  expect(menu.status()).toBe(200);
  const menuHtml = await menu.text();
  expect(menuHtml).toContain("Crispy Chicken Burger");
  expect(menuHtml).not.toContain('href="/admin"');
  expect(menuHtml).not.toContain('href="/controller"');
  const catalog: Catalog = await (
    await visitor.get("/api/catalog/table-and-thyme")
  ).json();
  const table = await visitor.get(
    restaurantUrl("table-and-thyme", { table: catalog.tables[0].id }),
  );
  expect(await table.text()).toContain("Create New Bucket");
  expect(await (await visitor.get("/restaurant")).text()).toContain(
    "This table isn’t here.",
  );
  expect(
    await (
      await visitor.get("/restaurant?slug=table-and-thyme&table=999")
    ).text(),
  ).toContain("This table isn’t here.");
  const old = await visitor.get(
    `/r/table-and-thyme/t/${catalog.tables[0].id}`,
    { maxRedirects: 0 },
  );
  expect(old.status()).toBe(307);
  expect(old.headers().location).toBe(
    restaurantUrl("table-and-thyme", { table: catalog.tables[0].id }),
  );
});
test("one hidden /admin entry renders the workspace matching the signed-in role", async () => {
  expect(await (await visitor.get("/admin")).text()).toContain("Welcome back.");
  expect(await (await controller.get("/admin")).text()).toContain(
    "Every table. One place.",
  );
  expect(await (await admin.get("/admin")).text()).toContain(
    "Restaurant overview.",
  );
  expect(await (await staff.get("/admin")).text()).toContain(
    "Service overview.",
  );
  for (const path of ["/controller", "/staff"]) {
    const result = await visitor.get(path, { maxRedirects: 0 });
    expect(result.status()).toBe(307);
    expect(result.headers().location).toBe("/admin");
  }
});
test("owner enquiries persist privately for controller follow-up without creating a restaurant", async () => {
  const before: Workspace = await (
    await controller.get("/api/workspace")
  ).json();
  const invalid = await visitor.post("/api/integration-requests", {
    data: { ...lead, email: "invalid" },
  });
  expect(invalid.status()).toBe(400);
  const result = await visitor.post("/api/integration-requests", {
    data: lead,
  });
  expect(result.status()).toBe(201);
  const after: Workspace = await (
    await controller.get("/api/workspace")
  ).json();
  expect(after.restaurants.length).toBe(before.restaurants.length);
  const saved = after.integrationRequests.find((r) => r.email === email)!;
  expect(saved.restaurantName).toBe(lead.restaurantName);
  expect(saved.notes).toBe(lead.notes);
  expect(saved.status).toBe("NEW");
  const regular: Workspace = await (await admin.get("/api/workspace")).json();
  expect(regular.integrationRequests).toEqual([]);
  const denied = await admin.post("/api/manage/integration-requests", {
    data: { op: "update", id: saved.id, data: { status: "CONTACTED" } },
  });
  expect(denied.status()).toBe(403);
  const updated = await controller.post("/api/manage/integration-requests", {
    data: { op: "update", id: saved.id, data: { status: "CONTACTED" } },
  });
  expect(updated.status()).toBe(200);
  const persisted: Workspace = await (
    await controller.get("/api/workspace")
  ).json();
  expect(
    persisted.integrationRequests.find((r) => r.id === saved.id)?.status,
  ).toBe("CONTACTED");
  expect((await visitor.get("/api/integration-requests")).status()).toBe(404);
});
