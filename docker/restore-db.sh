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
#   - It also refuses to run against a non-local Docker daemon (a remote
#     DOCKER_HOST or DOCKER_CONTEXT, or a remote configured context), since
#     compose would run the destructive commands there instead.
#   - The dump is restored into a scratch database first. `cord` is only dropped
#     and replaced once that restore has fully succeeded, so a truncated or
#     corrupt dump leaves your existing database untouched.
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
      sed -n '4,43p' "$0"
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

# Refuse a non-local Docker daemon. `docker compose` follows DOCKER_HOST,
# DOCKER_CONTEXT and the configured Docker context, so a remote daemon that
# happens to have a matching `postgres` service would receive the drop/restore.
# Which of these wins is not something to rely on (the docs and the CLI's actual
# behavior have disagreed, and it can vary by version), so every one that could
# be in play must be local, not just the one we think takes precedence.
local_endpoint() {
  case $1 in
    unix://* | npipe://* | tcp://localhost | tcp://localhost:* | tcp://127.0.0.1 | tcp://127.0.0.1:* | 'tcp://[::1]' | 'tcp://[::1]:'*) return 0 ;;
    *) return 1 ;;
  esac
}
context_endpoint() { docker context inspect "$@" --format '{{.Endpoints.docker.Host}}' 2>/dev/null; }

DAEMON_DESC=""
DAEMON_LOCAL=true
if [[ -n ${DOCKER_HOST:-} ]]; then
  DAEMON_DESC="DOCKER_HOST=$DOCKER_HOST"
  local_endpoint "$DOCKER_HOST" || DAEMON_LOCAL=false
fi
if [[ -n ${DOCKER_CONTEXT:-} ]]; then
  ctx_endpoint=$(context_endpoint "$DOCKER_CONTEXT" || true)
  DAEMON_DESC+="${DAEMON_DESC:+, }DOCKER_CONTEXT=$DOCKER_CONTEXT (${ctx_endpoint:-unresolvable})"
  { [[ -n $ctx_endpoint ]] && local_endpoint "$ctx_endpoint"; } || DAEMON_LOCAL=false
fi
if [[ -z ${DOCKER_HOST:-} && -z ${DOCKER_CONTEXT:-} ]]; then
  ctx_endpoint=$(context_endpoint || true)
  DAEMON_DESC="context $(docker context show 2>/dev/null || echo default) (${ctx_endpoint:-default socket})"
  [[ -z $ctx_endpoint ]] || local_endpoint "$ctx_endpoint" || DAEMON_LOCAL=false
fi
$DAEMON_LOCAL || {
  echo "Refusing: the Docker daemon is not local: $DAEMON_DESC." >&2
  echo "Unset DOCKER_HOST / DOCKER_CONTEXT or switch to a local Docker context, then retry." >&2
  exit 1
}

# Every invocation gets its own scratch database and only ever drops the one it
# created, so concurrent runs (or one that bails out early) can't delete another
# run's in-flight restore.
INCOMING=${DB}_seed_incoming_$(date +%s)_$$
INCOMING_CREATED=false
TMPFILE=""
cleanup() {
  [[ -z $TMPFILE ]] || rm -f "$TMPFILE"
  # Exists only if this run created it and it wasn't renamed into place.
  if $INCOMING_CREATED; then
    docker compose exec -T postgres dropdb -U postgres --force --if-exists "$INCOMING" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

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
  TMPFILE=$(mktemp -t cord-seed.XXXXXX)
  FILE=$TMPFILE
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
echo "  daemon    : $DAEMON_DESC"
echo "  container : compose service 'postgres' ($(compose ps -q postgres | cut -c1-12))"
echo "  database  : $DB"
echo "  dump      : $FILE"
echo
if ! $ASSUME_YES; then
  read -r -p "Type the database name ($DB) to continue: " answer
  [[ $answer == "$DB" ]] || { echo "Aborted."; exit 1; }
fi

# Restore --------------------------------------------------------------------------
# Restore into a scratch database first and only replace $DB once that has fully
# succeeded: the header check above can't tell a truncated or corrupt archive
# from a good one, and dropping $DB before finding out would lose local data.
echo "==> Restoring into scratch database $INCOMING"
INCOMING_CREATED=true
compose exec -T postgres createdb -U postgres "$INCOMING"
compose exec -T postgres pg_restore -U postgres -d "$INCOMING" \
  --no-owner --no-privileges --exit-on-error <"$FILE"

stamp="cord-seed-lineage=$LINEAGE; restored=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
psql_c -d postgres -c "comment on database $INCOMING is '$stamp'" >/dev/null

echo "==> Restore succeeded; replacing $DB"
compose exec -T postgres dropdb -U postgres --force --if-exists "$DB"
psql_c -d postgres -c "alter database $INCOMING rename to $DB" >/dev/null

# The migration summary is informational: a dump without drizzle's bookkeeping
# table is still a successful restore.
if [[ $(psql_c -d "$DB" -c "select to_regclass('drizzle.__drizzle_migrations') is not null") == t ]]; then
  echo "==> Done. Newest applied migration in the dump:"
  psql_c -d "$DB" -c "select max(created_at) from drizzle.__drizzle_migrations"
else
  echo "==> Done. (This dump has no migration history.)"
fi
echo "Start the API; it will apply any newer migrations on boot."
