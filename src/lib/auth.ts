import {
  createHmac,
  randomBytes,
  scryptSync,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { db } from "@/db";
import { users } from "@/db/schema";
import { eq } from "drizzle-orm";

export function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  return `${salt}:${scryptSync(password, salt, 64).toString("hex")}`;
}
export function verifyPassword(password: string, hash: string) {
  const [salt, stored] = hash.split(":");
  if (!salt || !stored) return false;
  const actual = scryptSync(password, salt, 64);
  const expected = Buffer.from(stored, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
function secret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  if (process.env.NODE_ENV === "production")
    throw new Error("SESSION_SECRET is required in production.");
  return "table-thyme-local-development-secret-only";
}
export async function setIdentity(kind: "guest" | "user", id: string) {
  const payload = Buffer.from(
    JSON.stringify({ id, expires: Date.now() + 30 * 86400000 }),
  ).toString("base64url");
  const signature = createHmac("sha256", secret())
    .update(`${kind}:${payload}`)
    .digest("base64url");
  (await cookies()).set(`tt_${kind}`, `${payload}.${signature}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 30 * 86400,
  });
}
export async function identity(kind: "guest" | "user") {
  const value = (await cookies()).get(`tt_${kind}`)?.value;
  if (!value) return null;
  const [payload, signature] = value.split(".");
  const expected = createHmac("sha256", secret())
    .update(`${kind}:${payload}`)
    .digest("base64url");
  if (
    !signature ||
    signature.length !== expected.length ||
    !timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  )
    return null;
  try {
    const parsed = JSON.parse(Buffer.from(payload, "base64url").toString());
    return parsed.expires > Date.now() ? (parsed.id as string) : null;
  } catch {
    return null;
  }
}
export async function currentUser() {
  const id = await identity("user");
  if (!id) return null;
  return (
    (
      await db
        .select({
          id: users.id,
          name: users.name,
          role: users.role,
          restaurantId: users.restaurantId,
          email: users.email,
        })
        .from(users)
        .where(eq(users.id, id))
    )[0] ?? null
  );
}
