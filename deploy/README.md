# orderCup production deployment

Public site: https://ordercup.duckdns.org

This server deployment uses a separate Docker Compose project named `ordercup`. The existing `deployment` and `telegram-context` projects are separate. Do not restart those projects or edit their configuration when deploying orderCup.

## Layout

- `/home/abdurrauf/ordercup/releases/<release-id>`: release source files.
- `/home/abdurrauf/ordercup/current`: symlink to the active release.
- `/home/abdurrauf/ordercup/shared/.env`: private database, session, and initial account secrets (mode 600).
- `/home/abdurrauf/ordercup/shared/release-id`: active Docker image tag.
- `/home/abdurrauf/ordercup/backups`: private database backups.
- Docker volume `ordercup_ordercup_pgdata`: orderCup's persistent PostgreSQL data.

The web container joins the existing external `traefik_net` network. Its uniquely named `ordercup` router matches only `ordercup.duckdns.org` and uses the existing `myresolver` TLS resolver. The new PostgreSQL container uses an internal network and publishes no port. The web container also publishes no host port; only Traefik serves public traffic.

`Dockerfile` has a `tooling` target for migrations/seeding and a minimal, non-root `runner` target using Next.js standalone output. Runtime secrets are supplied by Compose rather than baked into images. Development credential shortcuts are hidden in production. Initial production accounts use a generated password, not the documented local mock password.

## Deploy a release

Upload a source archive to `releases/source.tar.gz`, excluding `.env` files, local database files, `.git`, dependencies, generated builds, and `production-credentials.md`. Then upload `deploy/server-release.sh` as `/home/abdurrauf/ordercup/deploy-release.sh` and run:

```sh
ssh abdurrauf@13.42.149.214 bash /home/abdurrauf/ordercup/deploy-release.sh YYYYMMDDTHHMMSSZ
```

The script builds tagged images, starts only orderCup's database, applies orderCup migrations, creates the demo tenant if absent, and starts only orderCup's web service. It neither modifies nor restarts Traefik or the other applications. Secrets are generated on the first run and preserved on subsequent deployments. Seeding skips an existing demo restaurant and never resets edited menu data or account passwords.

## Operations

Run these commands on the server:

```sh
cd /home/abdurrauf/ordercup
export RELEASE_TAG="$(cat shared/release-id)"
# Define this shell helper; no secrets are printed.
oc() { docker compose --project-name ordercup --env-file "$PWD/shared/.env" -f "$PWD/current/deploy/compose.production.yaml" "$@"; }
oc ps
oc logs --tail 100 web
curl --fail https://ordercup.duckdns.org/api/health
```

The health endpoint checks PostgreSQL and returns `{"status":"ok"}`. Traefik streams SSE responses without buffering; the app sends heartbeat events and polls the database for shared updates.

Before future database migrations, back up orderCup's database:

```sh
oc exec -T db pg_dump -U ordercup -d ordercup > "backups/ordercup-$(date -u +%Y%m%dT%H%M%SZ).sql"
chmod 600 backups/*.sql
```

To roll back the application image, set `RELEASE_TAG` to a previously built release tag and run `oc up -d --no-deps web`. Check database migration compatibility first. Never use `down -v`, which removes persistent data. To stop only orderCup's web service, use `oc stop web`.

After a deployment, confirm the existing application still returns HTTP 200 at https://the-wagwan.duckdns.org and compare its container IDs/start times against `shared/existing-containers-before.txt`. Its Compose file hash is recorded in `shared/existing-compose-before.sha256`.
