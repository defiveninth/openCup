import {
  test,
  expect,
  request,
  type APIRequestContext,
} from "@playwright/test";
import { loadEnvConfig } from "@next/env";
import {
  bill,
  type Bucket,
  type Catalog,
  type Workspace,
} from "../src/lib/types";
loadEnvConfig(process.cwd());

const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";
let controller: APIRequestContext,
  admin: APIRequestContext,
  staff: APIRequestContext,
  host: APIRequestContext,
  friend: APIRequestContext,
  outsider: APIRequestContext;
let tenantId = "",
  catalog: Catalog,
  bucketId = "",
  hostParticipant = "",
  friendParticipant = "";
const suffix = Date.now();
async function post(
  ctx: APIRequestContext,
  path: string,
  data: unknown,
  status = 200,
) {
  const result = await ctx.post(`/api/${path}`, { data });
  expect(result.status(), await result.text()).toBe(status);
  return result.json();
}
async function bucket(): Promise<Bucket> {
  return (await host.get(`/api/buckets/${bucketId}`)).json();
}
test.describe.serial("Collaborative restaurant ordering", () => {
  test.beforeAll(async () => {
    [controller, admin, staff, host, friend, outsider] = await Promise.all(
      Array.from({ length: 6 }, () =>
        request.newContext({ baseURL, extraHTTPHeaders: { origin: baseURL } }),
      ),
    );
    await post(controller, "auth/login", {
      email: "controller@tableandthyme.local",
      password: process.env.SEED_PASSWORD ?? "TableThyme2026!",
    });
    await post(controller, "manage/restaurants", {
      op: "create",
      data: {
        name: "Integration Test Restaurant",
        slug: `test-${suffix}`,
        currency: "KZT",
        serviceChargePct: 10,
        isActive: true,
      },
      admin: {
        name: "Test manager",
        email: `manager-${suffix}@test.local`,
        password: "IntegrationTest2026!",
      },
    });
    await post(admin, "auth/login", {
      email: `manager-${suffix}@test.local`,
      password: "IntegrationTest2026!",
    });
    const workspace: Workspace = await (
      await admin.get("/api/workspace")
    ).json();
    tenantId = workspace.restaurants[0].id;
    await post(admin, "manage/categories", {
      op: "create",
      data: { name: "Test favorites", sortOrder: 0, isActive: true },
    });
    catalog = await (await admin.get(`/api/catalog/test-${suffix}`)).json();
    await post(admin, "manage/menu", {
      op: "create",
      data: {
        name: "Test burger",
        description: "A test dish",
        imageUrl: "",
        price: 1001,
        costPrice: 300,
        categoryId: catalog.categories[0].id,
        isAvailable: true,
      },
    });
    await post(admin, "manage/users", {
      op: "create",
      data: {
        name: "Test staff",
        email: `staff-${suffix}@test.local`,
        password: "IntegrationTest2026!",
        role: "STAFF",
      },
    });
    await post(staff, "auth/login", {
      email: `staff-${suffix}@test.local`,
      password: "IntegrationTest2026!",
    });
    catalog = await (await host.get(`/api/catalog/test-${suffix}`)).json();
    await post(host, "guest", { displayName: "Alex" });
    await post(friend, "guest", { displayName: "Sam" });
    await post(outsider, "guest", { displayName: "Taylor" });
    const created = await post(host, "buckets/create", {
      displayName: "Alex",
      restaurantId: tenantId,
      tableId: catalog.tables[0].id,
    });
    bucketId = created.id;
    await post(friend, `buckets/${bucketId}/join`, { displayName: "Sam" });
    const b = await bucket();
    hostParticipant = b.participants.find((p) => p.isHost)!.id;
    friendParticipant = b.participants.find((p) => !p.isHost)!.id;
  });
  test.afterAll(async () => {
    if (tenantId) {
      const postgres = (await import("postgres")).default;
      const sql = postgres(
        process.env.DATABASE_URL ?? "postgres://localhost:5433/table_thyme",
      );
      await sql`delete from restaurants where id=${tenantId} and slug=${`test-${suffix}`}`;
      await sql.end();
    }
    await Promise.all(
      [controller, admin, staff, host, friend, outsider]
        .filter(Boolean)
        .map((c) => c.dispose()),
    );
  });
  test("identity, ownership, concurrent counts, and host removal analytics", async () => {
    await post(friend, `buckets/${bucketId}/join`, { displayName: "Sam" });
    expect((await bucket()).participants).toHaveLength(2);
    expect((await outsider.get(`/api/buckets/${bucketId}`)).status()).toBe(403);
    const item = catalog.menu[0].id;
    await post(
      friend,
      `buckets/${bucketId}/items`,
      { menuItemId: item, participantId: hostParticipant, delta: 1 },
      403,
    );
    await post(
      outsider,
      `buckets/${bucketId}/items`,
      { menuItemId: item, delta: 1 },
      403,
    );
    await Promise.all(
      Array.from({ length: 10 }, () =>
        post(friend, `buckets/${bucketId}/items`, {
          menuItemId: item,
          delta: 1,
        }),
      ),
    );
    let b = await bucket();
    expect(
      b.items.find((i) => i.participantId === friendParticipant)?.quantity,
    ).toBe(10);
    await post(host, `buckets/${bucketId}/items`, {
      menuItemId: item,
      participantId: friendParticipant,
      delta: -1,
    });
    await post(host, `buckets/${bucketId}/items`, {
      menuItemId: item,
      delta: 1,
    });
    b = await bucket();
    expect(
      b.items.find((i) => i.participantId === friendParticipant)?.quantity,
    ).toBe(9);
    expect(
      b.items.find((i) => i.participantId === hostParticipant)?.quantity,
    ).toBe(1);
    const workspace: Workspace = await (
      await admin.get("/api/workspace")
    ).json();
    expect(workspace.analytics.products[0].hostRemoved).toBe(1);
    await post(friend, `buckets/${bucketId}/confirm`, {}, 403);
    await post(
      host,
      `buckets/${bucketId}/items`,
      { menuItemId: item, delta: 8 },
      400,
    );
    expect((await host.get("/api/session")).status()).toBe(200);
  });
  test("price snapshots, batch status, exact split, payment, and closure", async () => {
    await post(host, `buckets/${bucketId}/confirm`, {});
    let b = await bucket();
    expect(b.batches).toHaveLength(1);
    expect(b.items.every((i) => i.batchId)).toBe(true);
    const m = catalog.menu[0];
    await post(admin, "manage/menu", {
      op: "update",
      id: m.id,
      data: {
        name: m.name,
        description: m.description ?? "",
        imageUrl: "",
        price: 2000,
        costPrice: 300,
        categoryId: m.categoryId,
        isAvailable: true,
      },
    });
    expect((await bucket()).items.every((i) => i.unitPrice === 1001)).toBe(
      true,
    );
    await post(
      staff,
      "manage/batches",
      { op: "update", id: b.batches[0].id, data: { status: "SERVED" } },
      409,
    );
    await post(staff, "manage/batches", {
      op: "update",
      id: b.batches[0].id,
      data: { status: "COOKING" },
    });
    await post(host, `buckets/${bucketId}/items`, {
      menuItemId: m.id,
      delta: 1,
    });
    await post(
      host,
      `buckets/${bucketId}/request-payment`,
      { mode: "SEPARATE" },
      409,
    );
    await post(host, `buckets/${bucketId}/items`, {
      menuItemId: m.id,
      remove: true,
    });
    await post(
      friend,
      `buckets/${bucketId}/request-payment`,
      { mode: "TOGETHER" },
      403,
    );
    await post(host, `buckets/${bucketId}/request-payment`, {
      mode: "SEPARATE",
    });
    b = await bucket();
    const total = bill(b, 10);
    expect(total.subtotal).toBe(10010);
    expect(total.service).toBe(1001);
    expect(total.people.reduce((s, p) => s + p.total, 0)).toBe(total.total);
    expect(b.paymentMode).toBe("SEPARATE");
    await post(
      host,
      `buckets/${bucketId}/items`,
      { menuItemId: m.id, delta: 1 },
      409,
    );
    await post(staff, "manage/buckets", { op: "update", id: b.id }, 409);
    await post(staff, "manage/batches", {
      op: "update",
      id: b.batches[0].id,
      data: { status: "SERVED" },
    });
    await post(staff, "manage/buckets", { op: "update", id: b.id });
    expect((await bucket()).status).toBe("CLOSED");
    await post(friend, `buckets/${bucketId}/join`, { displayName: "Sam" }, 409);
    const workspace: Workspace = await (
      await admin.get("/api/workspace")
    ).json();
    expect(workspace.analytics.orders).toBe(1);
    expect(workspace.analytics.revenue).toBe(10010);
    expect(workspace.analytics.separate).toBe(1);
    expect(workspace.analytics.active).toBe(0);
  });
  test("staff restrictions, tenant isolation, availability, CRUD and page routes", async () => {
    const m = catalog.menu[0];
    expect(m.costPrice).toBeUndefined();
    await post(
      staff,
      "manage/categories",
      {
        op: "create",
        data: { name: "Forbidden", sortOrder: 0, isActive: true },
      },
      403,
    );
    await post(
      staff,
      "manage/restaurants",
      { op: "update", id: tenantId, data: {} },
      403,
    );
    await post(staff, "manage/menu", {
      op: "update",
      id: m.id,
      data: { isAvailable: false },
    });
    await post(host, "buckets/create", {
      displayName: "Alex",
      restaurantId: tenantId,
      tableId: catalog.tables[0].id,
    }).then(async (created) => {
      await post(
        host,
        `buckets/${created.id}/items`,
        { menuItemId: m.id, delta: 1 },
        409,
      );
    });
    await post(staff, "manage/menu", {
      op: "update",
      id: m.id,
      data: { isAvailable: true },
    });
    await post(admin, "manage/menu", { op: "delete", id: m.id }, 409);
    await post(
      admin,
      "manage/categories",
      { op: "delete", id: catalog.categories[0].id },
      409,
    );
    await post(admin, "manage/categories", {
      op: "create",
      data: { name: "Temporary", sortOrder: 1, isActive: true },
    });
    let c: Catalog = await (
      await host.get(`/api/catalog/test-${suffix}`)
    ).json();
    const temporary = c.categories.find((c) => c.name === "Temporary")!;
    await post(admin, "manage/categories", {
      op: "update",
      id: temporary.id,
      data: { name: "Hidden", sortOrder: 2, isActive: false },
    });
    c = await (await host.get(`/api/catalog/test-${suffix}`)).json();
    expect(c.categories.some((c) => c.id === temporary.id)).toBe(false);
    await post(admin, "manage/categories", { op: "delete", id: temporary.id });
    await post(admin, "manage/tables", { op: "create", data: { number: 22 } });
    c = await (await host.get(`/api/catalog/test-${suffix}`)).json();
    const table = c.tables.find((t) => t.number === 22)!;
    expect((await host.get(`/r/test-${suffix}/t/${table.id}`)).status()).toBe(
      200,
    );
    await post(admin, "manage/tables", {
      op: "update",
      id: table.id,
      data: { number: 23 },
    });
    await post(admin, "manage/tables", { op: "delete", id: table.id });
    await post(
      admin,
      "manage/users",
      {
        op: "create",
        data: {
          name: "Invalid admin",
          email: `invalid-${suffix}@test.local`,
          password: "IntegrationTest2026!",
          role: "ADMIN",
        },
      },
      403,
    );
    const team: Workspace = await (await admin.get("/api/workspace")).json();
    const member = team.accounts.find((a) => a.role === "STAFF")!;
    await post(admin, "manage/users", {
      op: "update",
      id: member.id,
      data: {
        name: "Updated staff",
        email: member.email,
        password: "",
        role: "STAFF",
      },
    });
    await post(admin, "manage/users", {
      op: "create",
      data: {
        name: "Temporary member",
        email: `temp-${suffix}@test.local`,
        password: "IntegrationTest2026!",
        role: "STAFF",
      },
    });
    const updated: Workspace = await (await admin.get("/api/workspace")).json();
    const temp = updated.accounts.find(
      (a) => a.email === `temp-${suffix}@test.local`,
    )!;
    await post(admin, "manage/users", { op: "delete", id: temp.id });
    expect((await outsider.get("/api/workspace")).status()).toBe(401);
    const other: Catalog = await (
      await host.get("/api/catalog/table-and-thyme")
    ).json();
    await post(
      admin,
      "manage/menu",
      {
        op: "create",
        data: {
          name: "Wrong tenant",
          description: "",
          price: 20,
          costPrice: 10,
          imageUrl: "",
          categoryId: other.categories[0].id,
          isAvailable: true,
        },
      },
      400,
    );
    const denied = await host.post("/api/guest", {
      headers: { origin: "https://untrusted.example" },
      data: { displayName: "Alex" },
    });
    expect(denied.status()).toBe(403);
  });
  test("multiple batches remain immutable and a cancelled meal can be settled at zero", async () => {
    const created = await post(host, "buckets/create", {
      displayName: "Alex",
      restaurantId: tenantId,
      tableId: catalog.tables[0].id,
    });
    for (let round = 0; round < 2; round++) {
      await post(host, `buckets/${created.id}/items`, {
        menuItemId: catalog.menu[0].id,
        delta: 1,
      });
      await post(host, `buckets/${created.id}/confirm`, {});
    }
    let b: Bucket = await (await host.get(`/api/buckets/${created.id}`)).json();
    expect(b.batches.map((b) => b.batchNumber)).toEqual([1, 2]);
    expect(b.items).toHaveLength(2);
    expect(b.items.every((i) => i.batchId)).toBe(true);
    // A cart removal cannot modify either confirmed batch.
    await post(host, `buckets/${created.id}/items`, {
      menuItemId: catalog.menu[0].id,
      remove: true,
    });
    b = await (await host.get(`/api/buckets/${created.id}`)).json();
    expect(b.items).toHaveLength(2);
    for (const batch of b.batches)
      await post(staff, "manage/batches", {
        op: "update",
        id: batch.id,
        data: { status: "CANCELLED" },
      });
    b = await (await host.get(`/api/buckets/${created.id}`)).json();
    expect(bill(b, 10).total).toBe(0);
    await post(host, `buckets/${created.id}/request-payment`, {
      mode: "TOGETHER",
    });
    await post(staff, "manage/buckets", { op: "update", id: created.id });
    expect(
      (await (await host.get(`/api/buckets/${created.id}`)).json()).status,
    ).toBe("CLOSED");
  });
  test("SSE streams database updates and refuses unauthorized bucket access", async () => {
    const denied = await outsider.get(`/api/events?bucket=${bucketId}`);
    expect(denied.status()).toBe(403);
    const created = await post(host, "buckets/create", {
      displayName: "Alex",
      restaurantId: tenantId,
      tableId: catalog.tables[0].id,
    });
    const cookies = (await host.storageState()).cookies
      .map((c) => `${c.name}=${c.value}`)
      .join("; ");
    const abort = new AbortController();
    const response = await fetch(`${baseURL}/api/events?bucket=${created.id}`, {
      headers: { cookie: cookies },
      signal: abort.signal,
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toContain("text/event-stream");
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const first = decoder.decode((await reader.read()).value);
    expect(first).toContain("bucket:updated");
    await post(host, `buckets/${created.id}/items`, {
      menuItemId: catalog.menu[0].id,
      delta: 1,
    });
    let updated = "";
    const limit = Date.now() + 10000;
    while (Date.now() < limit && !updated.includes(catalog.menu[0].id))
      updated += decoder.decode((await reader.read()).value);
    expect(updated).toContain(catalog.menu[0].id);
    abort.abort();
  });
});

test("bill rounding allocates service only to guests who ordered", () => {
  const b = {
    participants: [
      { id: "a", displayName: "A" },
      { id: "b", displayName: "B" },
      { id: "c", displayName: "C" },
    ],
    items: [
      {
        id: "1",
        participantId: "a",
        batchId: "x",
        quantity: 1,
        unitPrice: 1001,
      },
      {
        id: "2",
        participantId: "b",
        batchId: "x",
        quantity: 1,
        unitPrice: 1001,
      },
    ],
    batches: [{ id: "x", status: "SERVED" }],
  } as Bucket;
  const total = bill(b, 10);
  expect(total.people[2].total).toBe(0);
  expect(total.people.reduce((s, p) => s + p.total, 0)).toBe(total.total);
});
