import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
const dir = path.resolve(".data/postgres");
const bin =
  process.env.PG_BIN ??
  (existsSync("/Applications/Postgres.app/Contents/Versions/latest/bin")
    ? "/Applications/Postgres.app/Contents/Versions/latest/bin"
    : "");
function run(name, args, allowFailure = false) {
  const result = spawnSync(bin ? path.join(bin, name) : name, args, {
    stdio: "inherit",
  });
  if (result.status && !allowFailure) process.exit(result.status);
  return result.status;
}
mkdirSync(path.dirname(dir), { recursive: true });
if (!existsSync(path.join(dir, "PG_VERSION")))
  run("initdb", ["-D", dir, "-A", "trust", "--no-locale", "-E", "UTF8"]);
if (run("pg_ctl", ["-D", dir, "status"], true))
  run("pg_ctl", [
    "-D",
    dir,
    "-l",
    path.resolve(".data/postgres.log"),
    "-o",
    "-p 5433 -h 127.0.0.1 -k /tmp",
    "start",
  ]);
run("createdb", ["-h", "127.0.0.1", "-p", "5433", "table_thyme"], true);
console.log(
  "Local PostgreSQL ready on port 5433. Run pnpm db:migrate && pnpm db:seed.",
);
