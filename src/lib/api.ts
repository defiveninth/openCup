import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { and, eq, isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db";
import * as s from "@/db/schema";
import {
  currentUser,
  hashPassword,
  identity,
  setIdentity,
  verifyPassword,
} from "./auth";
import { catalog, getBucket, workspace } from "./data";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
const fail = (status: number, message: string): never => {
  throw new HttpError(status, message);
};
const uuid = z.string().uuid();
const nameSchema = z.object({ displayName: z.string().trim().min(1).max(40) });
export async function guest() {
  const id = await identity("guest");
  if (!id) return fail(401, "Enter your name to join the table.");
  return id;
}
export async function authorizeBucket(id: string) {
  const guestId = await identity("guest");
  const bucket = await getBucket(id);
  if (!bucket) return fail(404, "Bucket not found.");
  if (guestId && bucket.participants.some((p) => p.guestUuid === guestId))
    return bucket;
  const user = await currentUser();
  if (
    user &&
    (user.role === "CONTROLLER" || user.restaurantId === bucket.restaurantId)
  )
    return bucket;
  return fail(403, "Join this bucket first.");
}
const loginAttempts = new Map<string, { count: number; until: number }>();
export async function handle(request: Request, path: string[]) {
  if (request.method !== "GET") {
    const origin = request.headers.get("origin");
    // Next.js may normalize request.url to localhost behind its development proxy.
    // The incoming Host still identifies the actual browser origin.
    if (origin) {
      let originHost;
      try {
        originHost = new URL(origin).host;
      } catch {
        return fail(403, "Invalid request origin.");
      }
      if (originHost !== request.headers.get("host"))
        fail(403, "Invalid request origin.");
    }
  }
  const key = path.join("/");
  if (request.method === "GET") {
    if (key === "session")
      return NextResponse.json({
        user: await currentUser(),
        guestUuid: await identity("guest"),
      });
    if (path[0] === "catalog")
      return NextResponse.json(await catalog(path[1] ?? "table-and-thyme"));
    if (path[0] === "buckets" && path.length === 2)
      return NextResponse.json(await authorizeBucket(uuid.parse(path[1])));
    if (key === "workspace") {
      const user = await currentUser();
      if (!user) fail(401, "Please sign in.");
      return NextResponse.json(await workspace(user!));
    }
    fail(404, "Not found.");
  }
  const raw = await request.text();
  if (raw.length > 65536) fail(413, "Request is too large.");
  let body;
  try {
    body = JSON.parse(raw);
  } catch {
    return fail(400, "Send a valid JSON request.");
  }
  if (!body || typeof body !== "object" || Array.isArray(body))
    fail(400, "Send a JSON object.");
  if (key === "integration-requests") {
    const input = z
      .object({
        restaurantName: z
          .string()
          .trim()
          .min(2, "Enter your restaurant’s name.")
          .max(120),
        contactName: z.string().trim().min(2, "Enter your name.").max(100),
        email: z.string().trim().email("Enter a valid email address.").max(254),
        phone: z.string().trim().max(40).default(""),
        city: z.string().trim().min(2, "Enter your city.").max(100),
        tableCount: z.number().int().min(1).max(9999).nullable().optional(),
        notes: z.string().trim().max(2000).default(""),
        website: z.string().max(500).default(""),
      })
      .parse(body);
    if (input.website) return NextResponse.json({ ok: true });
    await db.insert(s.integrationRequests).values({
      restaurantName: input.restaurantName,
      contactName: input.contactName,
      email: input.email.toLowerCase(),
      phone: input.phone || null,
      city: input.city,
      tableCount: input.tableCount ?? null,
      notes: input.notes || null,
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  }
  if (key === "guest") {
    const { displayName } = nameSchema.parse(body);
    const id = (await identity("guest")) ?? crypto.randomUUID();
    await setIdentity("guest", id);
    return NextResponse.json({ guestUuid: id, displayName });
  }
  if (key === "auth/login") {
    const { email, password } = z
      .object({
        email: z.string().email(),
        password: z.string().min(1).max(200),
      })
      .parse(body);
    const attempt = loginAttempts.get(email);
    if (attempt && attempt.until > Date.now() && attempt.count >= 10)
      fail(429, "Too many attempts. Try again in 15 minutes.");
    const user = (
      await db
        .select()
        .from(s.users)
        .where(eq(s.users.email, email.toLowerCase()))
    )[0];
    if (!user || !verifyPassword(password, user.passwordHash)) {
      loginAttempts.set(email, {
        count: attempt && attempt.until > Date.now() ? attempt.count + 1 : 1,
        until: Date.now() + 900000,
      });
      fail(401, "Email or password is incorrect.");
    }
    loginAttempts.delete(email);
    await setIdentity("user", user.id);
    return NextResponse.json({ role: user.role });
  }
  if (key === "auth/logout") {
    (await cookies()).delete("tt_user");
    return NextResponse.json({ ok: true });
  }
  if (key === "buckets/create") {
    const actor = await guest();
    const input = nameSchema
      .extend({ tableId: uuid, restaurantId: uuid })
      .parse(body);
    const table = (
      await db
        .select()
        .from(s.tables)
        .innerJoin(s.restaurants, eq(s.tables.restaurantId, s.restaurants.id))
        .where(
          and(
            eq(s.tables.id, input.tableId),
            eq(s.tables.restaurantId, input.restaurantId),
            eq(s.restaurants.isActive, true),
          ),
        )
    )[0];
    if (!table) fail(404, "Table is unavailable.");
    const id = await db.transaction(async (tx) => {
      const [bucket] = await tx
        .insert(s.buckets)
        .values({
          tableId: input.tableId,
          restaurantId: input.restaurantId,
          hostGuestId: actor,
        })
        .returning();
      await tx.insert(s.bucketParticipants).values({
        bucketId: bucket.id,
        guestUuid: actor,
        displayName: input.displayName,
        isHost: true,
      });
      return bucket.id;
    });
    return NextResponse.json({ id });
  }
  if (path[0] === "buckets" && path.length === 3) {
    const id = uuid.parse(path[1]);
    const action = path[2];
    const actor = await guest();
    await db.transaction(async (tx) => {
      const [bucket] = await tx
        .select()
        .from(s.buckets)
        .where(eq(s.buckets.id, id))
        .for("update");
      if (!bucket) fail(404, "Bucket not found.");
      if (bucket.status === "CLOSED")
        fail(409, "This table session is closed.");
      const [restaurant] = await tx
        .select()
        .from(s.restaurants)
        .where(eq(s.restaurants.id, bucket.restaurantId));
      if (!restaurant?.isActive)
        fail(409, "This restaurant is not accepting orders.");
      if (action === "join") {
        const { displayName } = nameSchema.parse(body);
        await tx
          .insert(s.bucketParticipants)
          .values({
            bucketId: id,
            guestUuid: actor,
            displayName,
            isHost: actor === bucket.hostGuestId,
          })
          .onConflictDoUpdate({
            target: [
              s.bucketParticipants.bucketId,
              s.bucketParticipants.guestUuid,
            ],
            set: { displayName },
          });
        return;
      }
      const [participant] = await tx
        .select()
        .from(s.bucketParticipants)
        .where(
          and(
            eq(s.bucketParticipants.bucketId, id),
            eq(s.bucketParticipants.guestUuid, actor),
          ),
        );
      if (!participant) fail(403, "Join this bucket first.");
      const host = bucket.hostGuestId === actor;
      if (bucket.status !== "OPEN")
        fail(409, "Payment has been requested. Ask your waiter for help.");
      if (action === "items") {
        const input = z
          .object({
            menuItemId: uuid,
            participantId: uuid.optional(),
            delta: z.union([z.literal(1), z.literal(-1)]).optional(),
            remove: z.boolean().optional(),
          })
          .parse(body);
        if (!input.remove && !input.delta) fail(400, "Choose an item action.");
        const target = input.participantId ?? participant.id;
        const [owner] = await tx
          .select()
          .from(s.bucketParticipants)
          .where(
            and(
              eq(s.bucketParticipants.id, target),
              eq(s.bucketParticipants.bucketId, id),
            ),
          );
        if (!owner || (owner.guestUuid !== actor && !host))
          fail(403, "You can only change your own items.");
        const [item] = await tx
          .select()
          .from(s.menuItems)
          .innerJoin(s.categories, eq(s.menuItems.categoryId, s.categories.id))
          .where(
            and(
              eq(s.menuItems.id, input.menuItemId),
              eq(s.menuItems.restaurantId, bucket.restaurantId),
            ),
          );
        if (!item) fail(404, "Menu item not found.");
        if (
          input.delta === 1 &&
          (!item.menu_items.isAvailable || !item.categories.isActive)
        )
          fail(409, "This item is currently unavailable.");
        const filter = and(
          eq(s.bucketItems.bucketId, id),
          eq(s.bucketItems.participantId, target),
          eq(s.bucketItems.menuItemId, input.menuItemId),
          isNull(s.bucketItems.batchId),
        );
        const [existing] = await tx.select().from(s.bucketItems).where(filter);
        const previous = existing?.quantity ?? 0;
        const next = input.remove ? 0 : Math.max(0, previous + input.delta!);
        if (next > 99) fail(400, "Maximum 99 of each item per person.");
        if (next === previous) return;
        if (!next) await tx.delete(s.bucketItems).where(filter);
        else if (existing)
          await tx.update(s.bucketItems).set({ quantity: next }).where(filter);
        else
          await tx.insert(s.bucketItems).values({
            bucketId: id,
            participantId: target,
            menuItemId: input.menuItemId,
            quantity: next,
            unitPrice: item.menu_items.price,
          });
        await tx.insert(s.analyticsEvents).values({
          restaurantId: bucket.restaurantId,
          bucketId: id,
          guestUuid: actor,
          menuItemId: input.menuItemId,
          quantity: Math.abs(next - previous),
          eventType:
            next > previous
              ? "ITEM_ADDED"
              : owner.guestUuid !== actor
                ? "ITEM_REMOVED_BY_HOST"
                : "ITEM_REMOVED_BY_USER",
        });
        return;
      }
      if (!host) fail(403, "Only the host can do this.");
      if (action === "confirm") {
        const items = await tx
          .select()
          .from(s.bucketItems)
          .where(
            and(eq(s.bucketItems.bucketId, id), isNull(s.bucketItems.batchId)),
          );
        if (!items.length) fail(400, "Your bucket is empty.");
        const unavailable = await tx
          .select({ id: s.menuItems.id })
          .from(s.menuItems)
          .innerJoin(s.categories, eq(s.categories.id, s.menuItems.categoryId))
          .where(
            and(
              eq(s.menuItems.restaurantId, bucket.restaurantId),
              sql`(${s.menuItems.isAvailable} = false or ${s.categories.isActive} = false)`,
            ),
          );
        if (items.some((i) => unavailable.some((m) => m.id === i.menuItemId)))
          fail(
            409,
            "An item is no longer available. Remove it before confirming.",
          );
        const batches = await tx
          .select()
          .from(s.orderBatches)
          .where(eq(s.orderBatches.bucketId, id));
        const [batch] = await tx
          .insert(s.orderBatches)
          .values({ bucketId: id, batchNumber: batches.length + 1 })
          .returning();
        await tx
          .update(s.bucketItems)
          .set({ batchId: batch.id })
          .where(
            and(eq(s.bucketItems.bucketId, id), isNull(s.bucketItems.batchId)),
          );
        const people = await tx
          .select()
          .from(s.bucketParticipants)
          .where(eq(s.bucketParticipants.bucketId, id));
        await tx.insert(s.analyticsEvents).values({
          restaurantId: bucket.restaurantId,
          bucketId: id,
          guestUuid: actor,
          eventType: "BATCH_CONFIRMED",
          partySize: people.length,
        });
        return;
      }
      if (action === "request-payment") {
        const { mode } = z
          .object({ mode: z.enum(["TOGETHER", "SEPARATE"]) })
          .parse(body);
        const items = await tx
          .select()
          .from(s.bucketItems)
          .where(eq(s.bucketItems.bucketId, id));
        if (items.some((i) => !i.batchId))
          fail(
            409,
            "Confirm or remove your current items before requesting payment.",
          );
        const confirmed = await tx
          .select()
          .from(s.orderBatches)
          .where(eq(s.orderBatches.bucketId, id));
        if (!confirmed.length)
          fail(400, "Confirm an order before requesting payment.");
        await tx
          .update(s.buckets)
          .set({ status: "PAYMENT_REQUESTED", paymentMode: mode })
          .where(eq(s.buckets.id, id));
        await tx.insert(s.analyticsEvents).values({
          restaurantId: bucket.restaurantId,
          bucketId: id,
          guestUuid: actor,
          eventType: "PAYMENT_REQUESTED",
        });
        return;
      }
      fail(404, "Unknown bucket action.");
    });
    return NextResponse.json(await getBucket(id));
  }
  if (path[0] === "manage") {
    const user = await currentUser();
    if (!user) return fail(401, "Please sign in.");
    const entity = path[1];
    const op = z.enum(["create", "update", "delete"]).parse(body.op);
    const id = op !== "create" ? uuid.parse(body.id) : undefined;
    if (entity === "integration-requests") {
      if (user.role !== "CONTROLLER") fail(403, "Controller access required.");
      if (op !== "update")
        fail(400, "Only request status updates are supported.");
      const data = z
        .object({ status: z.enum(["NEW", "CONTACTED"]) })
        .parse(body.data);
      const changed = await db
        .update(s.integrationRequests)
        .set(data)
        .where(eq(s.integrationRequests.id, id!))
        .returning({ id: s.integrationRequests.id });
      if (!changed.length) fail(404, "Request not found.");
      return NextResponse.json({ ok: true });
    }
    const restaurantId =
      user.role === "CONTROLLER"
        ? uuid.optional().parse(body.restaurantId)
        : user.restaurantId!;
    if (entity === "restaurants") {
      if (user.role !== "CONTROLLER") fail(403, "Controller access required.");
      if (op === "delete")
        fail(400, "Archive a restaurant by turning off its active status.");
      const data = z
        .object({
          name: z.string().trim().min(1).max(100),
          slug: z
            .string()
            .regex(/^[a-z0-9-]+$/)
            .max(80),
          currency: z.enum(["KZT", "USD", "EUR", "GBP"]),
          serviceChargePct: z.number().min(0).max(50),
          isActive: z.boolean(),
        })
        .parse(body.data);
      if (op === "update")
        await db
          .update(s.restaurants)
          .set(data)
          .where(eq(s.restaurants.id, id!));
      else {
        const admin = z
          .object({
            email: z.string().email(),
            password: z.string().min(10).max(200),
            name: z.string().min(1),
          })
          .parse(body.admin);
        await db.transaction(async (tx) => {
          const [restaurant] = await tx
            .insert(s.restaurants)
            .values(data)
            .returning();
          await tx.insert(s.users).values({
            restaurantId: restaurant.id,
            name: admin.name,
            email: admin.email.toLowerCase(),
            passwordHash: hashPassword(admin.password),
            role: "ADMIN",
          });
          await tx
            .insert(s.tables)
            .values({ restaurantId: restaurant.id, number: 1 });
        });
      }
      return NextResponse.json({ ok: true });
    }
    if (!restaurantId) fail(400, "Select a restaurant.");
    if (entity === "batches") {
      const { status } = z
        .object({ status: z.enum(["COOKING", "SERVED", "CANCELLED"]) })
        .parse(body.data);
      await db.transaction(async (tx) => {
        const [batch] = await tx
          .select({ batch: s.orderBatches })
          .from(s.orderBatches)
          .innerJoin(s.buckets, eq(s.buckets.id, s.orderBatches.bucketId))
          .where(
            and(
              eq(s.orderBatches.id, id!),
              eq(s.buckets.restaurantId, restaurantId!),
            ),
          )
          .for("update");
        if (!batch) fail(404, "Order not found.");
        const next =
          batch.batch.status === "PENDING"
            ? ["COOKING", "CANCELLED"]
            : batch.batch.status === "COOKING"
              ? ["SERVED", "CANCELLED"]
              : [];
        if (!next.includes(status))
          fail(409, "Order status has already changed.");
        await tx
          .update(s.orderBatches)
          .set({ status, servedAt: status === "SERVED" ? new Date() : null })
          .where(eq(s.orderBatches.id, id!));
      });
    } else if (entity === "buckets") {
      await db.transaction(async (tx) => {
        const [bucket] = await tx
          .select()
          .from(s.buckets)
          .where(
            and(
              eq(s.buckets.id, id!),
              eq(s.buckets.restaurantId, restaurantId!),
            ),
          )
          .for("update");
        if (!bucket || bucket.status !== "PAYMENT_REQUESTED")
          fail(409, "Only a bucket awaiting payment can be closed.");
        const unfinished = await tx
          .select()
          .from(s.orderBatches)
          .where(
            and(
              eq(s.orderBatches.bucketId, id!),
              sql`${s.orderBatches.status} in ('PENDING','COOKING')`,
            ),
          );
        if (unfinished.length)
          fail(409, "Serve or cancel all batches before closing the table.");
        await tx
          .update(s.buckets)
          .set({ status: "CLOSED", closedAt: new Date() })
          .where(eq(s.buckets.id, id!));
      });
    } else if (entity === "menu") {
      if (user.role === "STAFF") {
        if (op !== "update") fail(403, "Manager access required.");
        const { isAvailable } = z
          .object({ isAvailable: z.boolean() })
          .strict()
          .parse(body.data);
        await db
          .update(s.menuItems)
          .set({ isAvailable })
          .where(
            and(
              eq(s.menuItems.id, id!),
              eq(s.menuItems.restaurantId, restaurantId!),
            ),
          );
      } else if (op === "delete") {
        const existing = await db
          .select({ id: s.bucketItems.id })
          .from(s.bucketItems)
          .where(eq(s.bucketItems.menuItemId, id!));
        if (existing.length)
          fail(
            409,
            "This item has order history. Set it as unavailable to preserve records.",
          );
        await db
          .delete(s.menuItems)
          .where(
            and(
              eq(s.menuItems.id, id!),
              eq(s.menuItems.restaurantId, restaurantId!),
            ),
          );
      } else {
        const data = z
          .object({
            name: z.string().trim().min(1).max(100),
            nameKk: z.string().trim().max(100).optional(),
            nameEn: z.string().trim().max(100).optional(),
            descriptionKk: z.string().trim().max(500).optional(),
            descriptionEn: z.string().trim().max(500).optional(),
            description: z.string().max(500),
            imageUrl: z.union([
              z.literal(""),
              z
                .url()
                .refine(
                  (v) => v.startsWith("https://"),
                  "Use an HTTPS image URL",
                ),
            ]),
            price: z.number().int().min(0).max(10000000),
            costPrice: z.number().int().min(0).max(10000000),
            categoryId: uuid,
            isAvailable: z.boolean(),
          })
          .parse(body.data);
        const [category] = await db
          .select()
          .from(s.categories)
          .where(
            and(
              eq(s.categories.id, data.categoryId),
              eq(s.categories.restaurantId, restaurantId!),
            ),
          );
        if (!category) fail(400, "Choose a category from this restaurant.");
        if (op === "create")
          await db
            .insert(s.menuItems)
            .values({ ...data, restaurantId: restaurantId! });
        else
          await db
            .update(s.menuItems)
            .set(data)
            .where(
              and(
                eq(s.menuItems.id, id!),
                eq(s.menuItems.restaurantId, restaurantId!),
              ),
            );
      }
    } else if (entity === "categories") {
      if (user.role === "STAFF") fail(403, "Manager access required.");
      if (op === "delete") {
        const items = await db
          .select()
          .from(s.menuItems)
          .where(eq(s.menuItems.categoryId, id!));
        if (items.length)
          fail(409, "Move or remove the items in this category first.");
        await db
          .delete(s.categories)
          .where(
            and(
              eq(s.categories.id, id!),
              eq(s.categories.restaurantId, restaurantId!),
            ),
          );
      } else {
        const data = z
          .object({
            name: z.string().trim().min(1).max(80),
            nameKk: z.string().trim().max(80).optional(),
            nameEn: z.string().trim().max(80).optional(),
            sortOrder: z.number().int().min(0),
            isActive: z.boolean(),
          })
          .parse(body.data);
        if (op === "create")
          await db
            .insert(s.categories)
            .values({ ...data, restaurantId: restaurantId! });
        else
          await db
            .update(s.categories)
            .set(data)
            .where(
              and(
                eq(s.categories.id, id!),
                eq(s.categories.restaurantId, restaurantId!),
              ),
            );
      }
    } else if (entity === "tables") {
      if (user.role === "STAFF") fail(403, "Manager access required.");
      if (op === "delete") {
        const buckets = await db
          .select()
          .from(s.buckets)
          .where(eq(s.buckets.tableId, id!));
        if (buckets.length)
          fail(409, "This table has order history and cannot be deleted.");
        await db
          .delete(s.tables)
          .where(
            and(eq(s.tables.id, id!), eq(s.tables.restaurantId, restaurantId!)),
          );
      } else {
        const { number } = z
          .object({ number: z.number().int().min(1).max(999) })
          .parse(body.data);
        const duplicate = await db
          .select()
          .from(s.tables)
          .where(
            and(
              eq(s.tables.restaurantId, restaurantId!),
              eq(s.tables.number, number),
            ),
          );
        if (duplicate.some((t) => t.id !== id))
          fail(409, "That table number already exists.");
        if (op === "create")
          await db
            .insert(s.tables)
            .values({ number, restaurantId: restaurantId! });
        else
          await db
            .update(s.tables)
            .set({ number })
            .where(
              and(
                eq(s.tables.id, id!),
                eq(s.tables.restaurantId, restaurantId!),
              ),
            );
      }
    } else if (entity === "users") {
      if (user.role === "STAFF") fail(403, "Manager access required.");
      if (id) {
        const [target] = await db
          .select()
          .from(s.users)
          .where(
            and(eq(s.users.id, id), eq(s.users.restaurantId, restaurantId!)),
          );
        if (!target || (target.role !== "STAFF" && user.role !== "CONTROLLER"))
          fail(403, "You can only manage accounts for your team.");
        if (id === user.id)
          fail(400, "You cannot change your own access from the team board.");
        if (op === "delete") {
          await db
            .delete(s.users)
            .where(
              and(eq(s.users.id, id), eq(s.users.restaurantId, restaurantId!)),
            );
          return NextResponse.json({ ok: true });
        }
      }
      const data = z
        .object({
          name: z.string().trim().min(1).max(100),
          email: z.string().email(),
          password:
            op === "create"
              ? z.string().min(10).max(200)
              : z
                  .union([z.literal(""), z.string().min(10).max(200)])
                  .optional(),
          role: z.enum(["STAFF", "ADMIN"]),
        })
        .parse(body.data);
      if (data.role === "ADMIN" && user.role !== "CONTROLLER")
        fail(403, "Only a controller may create manager accounts.");
      if (op === "create")
        await db.insert(s.users).values({
          name: data.name,
          email: data.email.toLowerCase(),
          passwordHash: hashPassword(data.password!),
          role: data.role,
          restaurantId,
        });
      else
        await db
          .update(s.users)
          .set({
            name: data.name,
            email: data.email.toLowerCase(),
            role: data.role,
            ...(data.password
              ? { passwordHash: hashPassword(data.password) }
              : {}),
          })
          .where(
            and(eq(s.users.id, id!), eq(s.users.restaurantId, restaurantId!)),
          );
    } else fail(404, "Unknown resource.");
    return NextResponse.json({ ok: true });
  }
  fail(404, "Not found.");
}
export async function route(
  request: Request,
  context: { params: Promise<{ path: string[] }> },
) {
  try {
    return await handle(request, (await context.params).path);
  } catch (error) {
    if (error instanceof z.ZodError)
      return NextResponse.json(
        {
          error:
            error.issues.find((issue) => issue.code === "custom")?.message ??
            "Invalid input",
        },
        { status: 400 },
      );
    if (error instanceof HttpError)
      return NextResponse.json(
        { error: error.message },
        { status: error.status },
      );
    if (error instanceof Error && error.message === "Restaurant not found")
      return NextResponse.json({ error: error.message }, { status: 404 });
    const pgError = error as { code?: string; cause?: { code?: string } };
    if (pgError.code === "23505" || pgError.cause?.code === "23505")
      return NextResponse.json(
        { error: "That record already exists." },
        { status: 409 },
      );
    console.error(error);
    return NextResponse.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
