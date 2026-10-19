#!/usr/bin/env bash
# Local Supabase-compatible stack WITHOUT Docker (Linux/macOS + Postgres 15/16 installed).
#   Postgres :54322  ·  Auth :9999  ·  PostgREST :3001  ·  gateway :54321  ·  SMTP sink :2500
#
#   ./dev/local-supabase/start.sh          # first run: downloads binaries, creates DB, migrates, seeds
#   ./dev/local-supabase/start.sh stop     # stop everything
#
# If you have Docker, `npx supabase start` + `npx supabase db reset` is the official alternative;
# the migrations in supabase/migrations work with either.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
RUN="$HERE/.run"
mkdir -p "$RUN" "$HERE/bin"
PG_BIN="${PG_BIN:-$(dirname "$(command -v pg_ctl 2>/dev/null || ls /usr/lib/postgresql/*/bin/pg_ctl | sort -V | tail -1)")}"
PGPORT=54322
PSQL="psql -h 127.0.0.1 -p $PGPORT -U postgres -v ON_ERROR_STOP=1 -q"
OS=$(uname -s | tr '[:upper:]' '[:lower:]')

stop() {
  for f in "$RUN"/*.pid; do [ -f "$f" ] && kill "$(cat "$f")" 2>/dev/null || true; rm -f "$f"; done
  "$PG_BIN/pg_ctl" -D "$RUN/pgdata" stop -m fast >/dev/null 2>&1 || true
  echo "stopped"
}
[ "${1:-}" = "stop" ] && { stop; exit 0; }

# ---- binaries -------------------------------------------------------------------
if [ ! -x "$HERE/bin/postgrest" ]; then
  echo "Downloading PostgREST…"
  if [ "$OS" = darwin ]; then url=https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-macos-x64.tar.xz
  else url=https://github.com/PostgREST/postgrest/releases/download/v12.2.3/postgrest-v12.2.3-linux-static-x64.tar.xz; fi
  curl -sSL "$url" | tar xJ -C "$HERE/bin"
fi
if [ ! -x "$HERE/bin/auth" ]; then
  echo "Downloading Supabase Auth…"
  [ "$OS" = darwin ] && { echo "Supabase Auth has no macOS binary — use Docker (npx supabase start) on macOS."; exit 1; }
  curl -sSL https://github.com/supabase/auth/releases/download/v2.169.0/auth-v2.169.0-x86.tar.gz | tar xz -C "$HERE/bin"
fi

for port in 54321 54322 9999 3001 2500; do
  if (exec 3<>/dev/tcp/127.0.0.1/$port) 2>/dev/null; then
    echo "Port $port is already in use — run '$0 stop' or free it first."; exit 1
  fi
done

# ---- postgres -------------------------------------------------------------------
FIRST_RUN=0
if [ ! -d "$RUN/pgdata" ]; then
  FIRST_RUN=1
  "$PG_BIN/initdb" -D "$RUN/pgdata" -U postgres --auth=trust >/dev/null
fi
"$PG_BIN/pg_ctl" -D "$RUN/pgdata" -o "-p $PGPORT -k /tmp -c listen_addresses=127.0.0.1" -l "$RUN/postgres.log" start >/dev/null
sleep 2
[ $FIRST_RUN = 1 ] && $PSQL -f "$HERE/bootstrap.sql"

# ---- auth (runs its own migrations into schema auth) ----------------------------
set -a; . "$HERE/auth.env"; set +a
GOTRUE_DB_MIGRATIONS_PATH="$HERE/bin" nohup "$HERE/bin/auth" > "$RUN/auth.log" 2>&1 &
echo $! > "$RUN/auth.pid"
for i in $(seq 1 30); do curl -sf localhost:9999/health >/dev/null && break; sleep 1; done

# ---- app schema + seed ----------------------------------------------------------
if [ $FIRST_RUN = 1 ]; then
  for f in "$ROOT"/supabase/migrations/*.sql; do echo "migrating $(basename "$f")"; $PSQL -f "$f"; done
  $PSQL -f "$ROOT/supabase/seed.sql"
fi

nohup "$HERE/bin/postgrest" "$HERE/postgrest.conf" > "$RUN/postgrest.log" 2>&1 &
echo $! > "$RUN/postgrest.pid"
DATA_DIR="$RUN/data" nohup node "$HERE/gateway.js" > "$RUN/gateway.log" 2>&1 &
echo $! > "$RUN/gateway.pid"
sleep 2

[ $FIRST_RUN = 1 ] && bash "$HERE/seed-users.sh"

. "$HERE/keys.env"
cat <<EOF

Local Supabase is up:  http://localhost:54321
Put this in .env, then run "npm start":
  REACT_APP_SUPABASE_URL=http://localhost:54321
  REACT_APP_SUPABASE_ANON_KEY=$ANON_KEY
Emails (password resets/invites) are captured at http://localhost:54321/mail
EOF
