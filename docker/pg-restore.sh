#!/bin/sh
# Restore a scrubbed production dump into the local compose Postgres.
#
#   yarn pg:restore ~/cord-dev-seed/cord-scrubbed-<date>.dump
#
# Drops and recreates the `cord` database first, so it works whether the
# database is still empty or the app has already booted and created tables
# (pg_restore will not overwrite those). Refuses to run while anything is
# connected to the database — stop the API first.
set -eu

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  echo "usage: yarn pg:restore <path-to-dump>" >&2
  exit 2
fi
if [ ! -f "$DUMP" ]; then
  echo "pg:restore: no such file: $DUMP" >&2
  exit 2
fi

# Same values as the postgres service in docker-compose.yml.
DB=cord
PG_USER=postgres

pg() { docker compose exec -T postgres "$@"; }

docker compose up -d postgres
tries=0
until pg pg_isready -U "$PG_USER" -q; do
  tries=$((tries + 1))
  if [ "$tries" -ge 30 ]; then
    echo "pg:restore: postgres did not become ready" >&2
    exit 1
  fi
  sleep 1
done

CONNECTED=$(pg psql -U "$PG_USER" -d postgres -tAc \
  "select count(*) from pg_stat_activity where datname = '$DB'")
if [ "$CONNECTED" -gt 0 ]; then
  echo "pg:restore: $CONNECTED connection(s) open on '$DB' — stop the API and try again" >&2
  exit 1
fi

echo "Recreating database '$DB'..."
pg dropdb -U "$PG_USER" --if-exists "$DB"
pg createdb -U "$PG_USER" "$DB"

echo "Restoring $DUMP..."
if pg pg_restore -U "$PG_USER" -d "$DB" --no-owner --no-privileges < "$DUMP"; then
  echo "Done. Sign in as devops@tsco.org / admin."
else
  status=$?
  echo "pg:restore: pg_restore exited $status — see the errors above." >&2
  exit "$status"
fi
