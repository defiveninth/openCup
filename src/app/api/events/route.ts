import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { authorizeBucket } from "@/lib/api";
import { catalog, workspace } from "@/lib/data";
import { z } from "zod";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const query = new URL(request.url).searchParams;
  const bucketId = query.get("bucket");
  const staff = query.get("staff") === "1";
  const user = staff ? await currentUser() : null;
  if (staff && !user)
    return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (bucketId) {
    if (!z.string().uuid().safeParse(bucketId).success)
      return new Response("Invalid bucket", { status: 400 });
    try {
      await authorizeBucket(bucketId);
    } catch {
      return new Response("Forbidden", { status: 403 });
    }
  }
  let cancelled = false;
  let timer: ReturnType<typeof setTimeout>;
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      let previous = "";
      const started = Date.now();
      async function poll() {
        if (cancelled) return;
        try {
          if (Date.now() - started > 15 * 60000) {
            controller.close();
            return;
          }
          const activeUser = staff ? await currentUser() : null;
          if (staff && !activeUser) {
            cancelled = true;
            controller.close();
            return;
          }
          const data = staff
            ? await workspace(activeUser!)
            : bucketId
              ? await authorizeBucket(bucketId)
              : await catalog(query.get("slug") ?? "table-and-thyme");
          const serialized = JSON.stringify(data);
          if (!cancelled) {
            let type = staff
              ? "restaurant:updated"
              : bucketId
                ? "bucket:updated"
                : "menu:item_toggled";
            if (staff && previous) {
              const old = JSON.parse(previous) as Awaited<
                ReturnType<typeof workspace>
              >;
              const next = data as Awaited<ReturnType<typeof workspace>>;
              if (
                next.buckets.some((b) =>
                  b.batches.some(
                    (batch) =>
                      !old.buckets.some((ob) =>
                        ob.batches.some((bb) => bb.id === batch.id),
                      ),
                  ),
                )
              )
                type = "order:new_batch";
              else if (
                next.buckets.some(
                  (b) =>
                    b.status === "PAYMENT_REQUESTED" &&
                    old.buckets.some(
                      (ob) => ob.id === b.id && ob.status === "OPEN",
                    ),
                )
              )
                type = "table:payment_requested";
              else if (
                next.catalogs.some((c) =>
                  c.menu.some((m) =>
                    old.catalogs.some((oc) =>
                      oc.menu.some(
                        (om) =>
                          om.id === m.id && om.isAvailable !== m.isAvailable,
                      ),
                    ),
                  ),
                )
              )
                type = "menu:item_toggled";
            }
            if (serialized !== previous)
              controller.enqueue(
                encoder.encode(`data: ${JSON.stringify({ type, data })}\n\n`),
              );
            else controller.enqueue(encoder.encode(": heartbeat\n\n"));
          }
          previous = serialized;
        } catch {
          if (!cancelled)
            controller.enqueue(
              encoder.encode("event: sync-error\ndata: {}\n\n"),
            );
        }
        if (!cancelled) timer = setTimeout(poll, 1500);
      }
      void poll();
      request.signal.addEventListener(
        "abort",
        () => {
          cancelled = true;
          clearTimeout(timer);
          try {
            controller.close();
          } catch {}
        },
        { once: true },
      );
    },
    cancel() {
      cancelled = true;
      clearTimeout(timer);
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
