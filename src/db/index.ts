import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

const globalDb = globalThis as unknown as {
  connection?: ReturnType<typeof postgres>;
};
const connection =
  globalDb.connection ??
  postgres(
    process.env.DATABASE_URL ?? "postgres://localhost:5433/table_thyme",
    { max: 10, prepare: false },
  );
if (process.env.NODE_ENV !== "production") globalDb.connection = connection;
export const db = drizzle(connection, { schema });
