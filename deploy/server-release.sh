#!/usr/bin/env bash
set -euo pipefail
release_id=${1:?Usage: server-release.sh RELEASE_ID}
[[ "$release_id" =~ ^[0-9]{8}T[0-9]{6}Z$ ]] || { echo 'Invalid release ID'; exit 1; }
root=/home/abdurrauf/ordercup
release="$root/releases/$release_id"
mkdir -p "$release"
tar --no-same-owner -xzf "$root/releases/source.tar.gz" -C "$release"
python3 - "$root/shared/.env" <<'PY'
import os,secrets,sys
path=sys.argv[1]
if not os.path.exists(path):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
    with os.fdopen(fd,'w') as f:
        f.write('DB_PASSWORD='+secrets.token_hex(24)+'\n')
        f.write('SESSION_SECRET='+secrets.token_hex(32)+'\n')
        f.write('SEED_PASSWORD='+secrets.token_urlsafe(24)+'\n')
PY
export RELEASE_TAG="$release_id"
compose=(docker compose --project-name ordercup --env-file "$root/shared/.env" -f "$release/deploy/compose.production.yaml")
"${compose[@]}" config --quiet
"${compose[@]}" --progress plain build tooling web
"${compose[@]}" up -d db --wait --wait-timeout 120
"${compose[@]}" --profile tools run --rm tooling pnpm db:migrate
"${compose[@]}" --profile tools run --rm tooling pnpm db:seed
"${compose[@]}" up -d web --wait --wait-timeout 120
ln -sfn "releases/$release_id" "$root/current"
printf '%s\n' "$release_id" > "$root/shared/release-id"
"${compose[@]}" ps
