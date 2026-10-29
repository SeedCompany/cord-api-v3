#!/usr/bin/env bash
set -euo pipefail

# =============================================================================
# restore-db.sh — reset the LOCAL docker-compose database from the scrubbed dump
# =============================================================================
#
# USAGE
#   yarn db:restore                     download the default dump from S3
#   yarn db:restore --s3 <uri|key>      a different S3 object (s3://bucket/key,
#                                       or a key within the seed-data bucket)
#   yarn db:restore --file path.dump    restore a dump you already have locally
#   yarn db:restore --yes               skip the typed confirmation
#
# WHAT IT DOES
#   1. Makes sure the compose `postgres` container is up.
#   2. Fetches the dump (S3 via your AWS credentials, or --file).
#   3. Drops and recreates the `cord` database INSIDE THE CONTAINER, then runs
#      pg_restore into it.
#   4. Stamps the database with a lineage marker (see below).
#   Start the API afterwards; it applies any migrations newer than the dump.
#
# SAFETY
#   - Everything goes through `docker compose exec` into the compose container.
#     It never connects over a host/port, so it cannot be pointed at an SSM
#     tunnel to a real environment (those forward RDS to localhost too).
#   - Lineage marker: a database restored from the scrubbed dump is stamped with
#     a comment `cord-seed-lineage=scrubbed`. A database that already carries a
#     DIFFERENT lineage is refused. An unmarked, non-empty database (your own
#     hand-built local data) is allowed after a warning and the confirmation —
#     it is your laptop. The deployed refresh is stricter; see infra.
#   - Stop the API first. Open connections are terminated (--force).
#
# REQUIREMENTS
#   docker, and for the S3 download the aws cli with credentials that can read
#   the seed-data bucket.
# =============================================================================

BUCKET=${CORD_SEED_BUCKET:-cord-v3-seed-data}
KEY=${CORD_SEED_KEY:-cord/scrubbed.dump}
REGION=${AWS_REGION:-us-east-2}
DB=cord
LINEAGE=scrubbed

FILE=""
S3SRC=""
ASSUME_YES=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --file)
      FILE=${2:-}
      [[ -n $FILE ]] || { echo "--file needs a path" >&2; exit 1; }
      shift 2
      ;;
    --s3)
      S3SRC=${2:-}
      [[ -n $S3SRC ]] || { echo "--s3 needs a uri or key" >&2; exit 1; }
      [[ $S3SRC == s3://* ]] || S3SRC="s3://$BUCKET/$S3SRC"
      shift 2
      ;;
    --yes | -y)
      ASSUME_YES=true
      shift
      ;;
    -h | --help)
      sed -n '4,38p' "$0"
      exit 0
      ;;
    *)
      echo "Unknown argument: $1 (try --help)" >&2
      exit 1
      ;;
  esac
done

[[ -z $FILE || -z $S3SRC ]] || {
  echo "Use either --file or --s3, not both." >&2
  exit 1
}

cd "$(dirname "$0")/.."

compose() { docker compose "$@"; }
psql_c() { compose exec -T postgres psql -U postgres -v ON_ERROR_STOP=1 -X -At "$@"; }

echo "==> Starting the compose postgres container"
compose up -d postgres >/dev/null
# Probe over TCP: on a first boot the image runs a temporary server that only
# listens on the unix socket, then restarts into the real one (after the SSL
# init script). A socket probe would pass during that window and then fail.
for _ in $(seq 1 60); do
  compose exec -T postgres pg_isready -h 127.0.0.1 -U postgres -q && break
  sleep 1
done
compose exec -T postgres pg_isready -h 127.0.0.1 -U postgres -q || {
  echo "Postgres did not become ready" >&2
  exit 1
}

# Layer: lineage marker --------------------------------------------------------
exists=$(psql_c -d postgres -c "select 1 from pg_database where datname = '$DB'")
marker=""
tables=0
if [[ -n $exists ]]; then
  marker=$(psql_c -d postgres -c \
    "select coalesce(shobj_description(oid, 'pg_database'), '') from pg_database where datname = '$DB'")
  tables=$(psql_c -d "$DB" -c \
    "select count(*) from information_schema.tables where table_schema in ('public', 'drizzle')")
fi

if [[ $marker == cord-seed-lineage=* && $marker != "cord-seed-lineage=$LINEAGE"* ]]; then
  echo "Refusing: local '$DB' is marked '$marker', not lineage '$LINEAGE'." >&2
  exit 1
fi
if [[ $tables -gt 0 && $marker != "cord-seed-lineage=$LINEAGE"* ]]; then
  echo "Note: local '$DB' has $tables table(s) and no seed marker (hand-built data)."
fi

# Fetch the dump ----------------------------------------------------------------
if [[ -z $FILE ]]; then
  command -v aws >/dev/null || {
    echo "aws cli not found. Install it, or pass --file <dump>." >&2
    exit 1
  }
  FILE=$(mktemp -t cord-seed.XXXXXX)
  trap 'rm -f "$FILE"' EXIT
  S3SRC=${S3SRC:-s3://$BUCKET/$KEY}
  echo "==> Downloading $S3SRC"
  aws s3 cp "$S3SRC" "$FILE" --region "$REGION" --only-show-errors
fi
[[ -f $FILE ]] || { echo "No such file: $FILE" >&2; exit 1; }
[[ $(head -c 5 "$FILE") == "PGDMP" ]] || {
  echo "$FILE is not a pg_dump custom-format archive (-Fc)." >&2
  exit 1
}

# Confirm --------------------------------------------------------------------------
echo
echo "About to WIPE and rebuild:"
echo "  container : compose service 'postgres' ($(compose ps -q postgres | cut -c1-12))"
echo "  database  : $DB"
echo "  dump      : $FILE"
echo
if ! $ASSUME_YES; then
  read -r -p "Type the database name ($DB) to continue: " answer
  [[ $answer == "$DB" ]] || { echo "Aborted."; exit 1; }
fi

# Restore --------------------------------------------------------------------------
echo "==> Recreating $DB"
compose exec -T postgres dropdb -U postgres --force --if-exists "$DB"
compose exec -T postgres createdb -U postgres "$DB"

echo "==> Restoring"
compose exec -T postgres pg_restore -U postgres -d "$DB" \
  --no-owner --no-privileges --exit-on-error <"$FILE"

stamp="cord-seed-lineage=$LINEAGE; restored=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
psql_c -d postgres -c "comment on database $DB is '$stamp'" >/dev/null

echo "==> Done. Newest applied migration in the dump:"
psql_c -d "$DB" -c "select max(created_at) from drizzle.__drizzle_migrations"
echo "Start the API; it will apply any newer migrations on boot."
