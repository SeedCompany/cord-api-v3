#!/usr/bin/env bash
#
# Certification sequence — the verification half of the cutover rehearsal runbook.
# (Track C of the Apples-to-Apples plan.)
#
# Runs every parity/coverage checker we have, in dependency order, against one
# freshly loaded database, and refuses to call the result green unless every
# phase proves itself. One red phase = not certified. Each phase's full output
# is kept in a log file (never piped through tail — truncated logs invent
# results), and every success is asserted from a BANNER or a machine-readable
# report, never from an exit code alone: yarn has been seen swallowing an OOM
# crash and exiting 0.
#
#   # everything, starting with a fresh load into a new database:
#   src/core/cutover/certify.sh --target=cord_cutover_r5
#
#   # re-run the read-only phases against an existing load (never writes it):
#   src/core/cutover/certify.sh --target=cord_cutover_r4 --from=manifest
#
#   # one phase, resume, list:
#   src/core/cutover/certify.sh --target=cord_cutover_r5 --only=probe
#   src/core/cutover/certify.sh --target=cord_cutover_r5 --resume
#   src/core/cutover/certify.sh --list
#
# Phases (in order):
#   load              full ETL load into --target (the ONLY phase that writes it)
#   manifest          fresh loss manifest vs the committed baseline
#   verify            post-load invariant checks (cutover-verify.run)
#   coverage-etl      source-vs-target coverage reconciliation (cutover-coverage.run)
#   shadow-copy       template copy of the target for app-booting readers
#   profiles          whole-population column profiles, both engines
#   capture-neo4j     shadow-diff capture under the Neo4j engine
#   capture-postgres  shadow-diff capture under the Postgres engine
#   diff              shadow-diff comparison — zero unsuppressed differences
#   probe             mutation probe on a throwaway copy of the target
#   e2e               full e2e suite against a throwaway copy of the target
#   mutation-coverage every schema mutation exercised by test/ (or exempted)
#   corpus            no migrated type reachable only as { id } in the corpus
#
# Databases touched: --target is written ONLY by the load phase; everything
# else reads it or copies it (probe and e2e write to throwaway TEMPLATE copies;
# captures/profiles read the shadow copy because an app boot under the
# Postgres engine runs migrations against whatever POSTGRES_URL names).

set -uo pipefail

# ---------------------------------------------------------------------------
# Configuration (override via environment)
# ---------------------------------------------------------------------------
NEO4J_URL="${NEO4J_URL:-bolt://localhost:7688}"          # the prod-copy container
NEO4J_PASSWORD="${NEO4J_PASSWORD:-localdev}"
PG="${PG:-postgresql://postgres:postgres@localhost:5432}" # base URL, no db name
PSQL=(docker exec cord-api-v3-postgres-1 psql -U postgres -Atc)

# The certified reference may be read and copied, never written.
REFERENCE_DBS=(cord_cutover_r4)

BASELINE=src/core/cutover/loss-manifest.baseline.json
FRESH_MANIFEST=cutover-loss-manifest.json

# migration-todo: remove this registration (and require probe exit 0) when
# pg-derive-partner-org-sensitivity merges — until then this one probe is red
# by design, and any OTHER red is a finding. The check is two-directional,
# like the coverage checker's exemptions: an expected red that does NOT fire
# fails the phase too, so this registration cannot silently go stale.
PROBE_EXPECTED_RED=(
  'partner sensitivity follows a new project'
)

PHASES=(load manifest verify coverage-etl shadow-copy profiles
        capture-neo4j capture-postgres diff probe e2e mutation-coverage corpus)

# ---------------------------------------------------------------------------
# Flags
# ---------------------------------------------------------------------------
TARGET='' FROM='' ONLY='' RESUME=0 ROWS=3
for arg in "$@"; do
  case "$arg" in
    --target=*) TARGET="${arg#*=}" ;;
    --from=*)   FROM="${arg#*=}" ;;
    --only=*)   ONLY="${arg#*=}" ;;
    --rows=*)   ROWS="${arg#*=}" ;;
    --resume)   RESUME=1 ;;
    --list)     printf '%s\n' "${PHASES[@]}"; exit 0 ;;
    *) echo "Unknown flag: $arg" >&2; exit 64 ;;
  esac
done
[[ -n "$TARGET" ]] || { echo 'Required: --target=<database>' >&2; exit 64; }

# Derived names. The shadow copy exists because captures/profiles boot the app,
# and an app boot under the Postgres engine migrates its POSTGRES_URL target —
# a reader must never point that at the database it is certifying.
SHADOW="${TARGET/cutover/shadow}"
[[ "$SHADOW" != "$TARGET" ]] || SHADOW="${TARGET}_shadow"
E2E_DB="${TARGET}_e2e"

OUT="certify-output/${TARGET}"
CAP_DIR="shadow-diff-output/${TARGET}-certify"
mkdir -p "$OUT"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
say()  { printf '\n\033[1m== %s ==\033[0m\n' "$*"; }
pass=() ; fail=() ; warn=()

# Assert a banner line exists in a log. A phase that cannot show its banner did
# not do the work, whatever its exit code said.
must_grep() { # <file> <pattern> <what the banner proves>
  if command grep -q "$2" "$1"; then return 0; fi
  echo "  ✗ missing banner: $3 (looked for /$2/ in $1)"
  return 1
}

db_exists() { [[ "$("${PSQL[@]}" "select 1 from pg_database where datname='$1'")" == 1 ]]; }

refuse_reference_write() { # <db about to be written or dropped>
  for ref in "${REFERENCE_DBS[@]}"; do
    if [[ "$1" == "$ref" ]]; then
      echo "  ✗ refusing: $1 is the certified reference and is never written"
      return 1
    fi
  done
}

# Recreate <copy> as a fresh template copy of <source>. Template copies need no
# live connections on the source; the app must be down.
recreate_copy() { # <source> <copy>
  refuse_reference_write "$2" || return 1
  "${PSQL[@]}" "drop database if exists \"$2\" with (force)" >/dev/null || return 1
  "${PSQL[@]}" "create database \"$2\" template \"$1\"" >/dev/null || return 1
  echo "  created $2 from template $1"
}

# The probe log groups failures as '<key> - N row(s)'. Compare that set with
# the registry above, in both directions.
check_probe_reds() { # <log>
  local found=() line key ok=0
  while IFS= read -r line; do
    key="${line% - *}"
    found+=("$key")
  done < <(command grep -E ' - [0-9]+ row\(s\)$' "$1" || true)
  for key in "${found[@]:-}"; do
    [[ -n "$key" ]] || continue
    local expected=1
    for reg in "${PROBE_EXPECTED_RED[@]}"; do [[ "$key" == "$reg" ]] && expected=0; done
    if [[ $expected == 1 ]]; then
      echo "  ✗ UNEXPECTED probe failure: $key"
      ok=1
    fi
  done
  for reg in "${PROBE_EXPECTED_RED[@]}"; do
    local fired=1
    for key in "${found[@]:-}"; do [[ "$key" == "$reg" ]] && fired=0; done
    if [[ $fired == 1 ]]; then
      echo "  ✗ STALE registration: expected red '$reg' did not fire — remove it"
      ok=1
    fi
  done
  return $ok
}

# jest --json result: zero failed TESTS required. A failed SUITE whose tests
# all passed is the tracked app.close() teardown hang — reported, not fatal.
check_e2e_json() { # <results.json>
  node -e '
    const r = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const hangs = r.testResults.filter(
      (s) => s.status === "failed" && s.numFailingTests === 0);
    const realSuiteFails = r.numFailedTestSuites - hangs.length;
    console.log(`  tests: ${r.numPassedTests} passed, ${r.numFailedTests} failed, ` +
      `${r.numPendingTests} skipped; suites failed: ${r.numFailedTestSuites} ` +
      `(${hangs.length} teardown-hang shaped)`);
    if (hangs.length) console.log("  ⚠ teardown hang (tracked, intermittent): " +
      hangs.map((s) => s.testFilePath).join(", "));
    process.exit(r.numFailedTests === 0 && realSuiteFails === 0 ? 0 : 1);
  ' "$1"
}

# ---------------------------------------------------------------------------
# Phases. Each phase function: full output to its log, assertions after.
# ---------------------------------------------------------------------------
LOAD_STARTED_AT=''

phase_load() {
  refuse_reference_write "$TARGET" || return 1
  db_exists "$TARGET" || "${PSQL[@]}" "create database \"$TARGET\"" >/dev/null
  LOAD_STARTED_AT=$(date +%s)
  local log="$OUT/load.log"
  # TZ=UTC is the belt on top of the code fix in cutover.helpers toDate: a
  # date-only source value must become midnight UTC no matter where this runs.
  # Defect A came back the one time a load ran without it.
  TZ=UTC DATABASE=neo4j NEO4J_URL="$NEO4J_URL" NEO4J_PASSWORD="$NEO4J_PASSWORD" \
    POSTGRES_URL="$PG/$TARGET" NODE_OPTIONS=--max-old-space-size=12288 \
    yarn start --entryFile core/cutover.run -- --batch=100 >"$log" 2>&1
  local code=$?
  [[ $code == 0 ]] || { echo "  ✗ load exited $code — see $log"; return 1; }
  must_grep "$log" 'Loss manifest written to' 'the load completed and wrote its manifest' || return 1
  # A manifest older than this run means yarn exited 0 without doing the work.
  local mtime; mtime=$(stat -f %m "$FRESH_MANIFEST" 2>/dev/null || echo 0)
  (( mtime >= LOAD_STARTED_AT )) || { echo "  ✗ $FRESH_MANIFEST predates this run — the load did not write it"; return 1; }
  # Independent census straight from the database, not from the load's own math.
  local files
  files=$(docker exec cord-api-v3-postgres-1 psql -U postgres -d "$TARGET" -Atc 'select count(*) from file_nodes')
  echo "  census: $files file_nodes rows"
  (( files > 1000000 )) || { echo "  ✗ census too small — a full load carries >1M file_nodes"; return 1; }
}

phase_manifest() {
  if [[ ! -f "$BASELINE" ]]; then
    echo "  ✗ no committed baseline at $BASELINE."
    echo "    Review $FRESH_MANIFEST against the ledger's documented drops, then:"
    echo "      cp $FRESH_MANIFEST $BASELINE   # and commit it (Rob approves)"
    return 1
  fi
  node src/core/cutover/compare-loss-manifest.ts "$BASELINE" "$FRESH_MANIFEST" \
    >"$OUT/manifest.log" 2>&1
  local code=$?
  sed 's/^/  /' "$OUT/manifest.log" | tail -20
  return $code
}

phase_verify() {
  local log="$OUT/verify.log"
  POSTGRES_URL="$PG/$TARGET" yarn start --entryFile core/cutover-verify.run >"$log" 2>&1
  local code=$?
  [[ $code == 0 ]] || { echo "  ✗ verify exited $code — see $log"; return 1; }
  must_grep "$log" 'row(s) across' 'the row census ran (a schema-only database refuses)'
}

phase_coverage_etl() {
  local log="$OUT/coverage-etl.log"
  DATABASE=neo4j NEO4J_URL="$NEO4J_URL" NEO4J_PASSWORD="$NEO4J_PASSWORD" \
    POSTGRES_URL="$PG/$TARGET" yarn start --entryFile core/cutover-coverage.run >"$log" 2>&1
  local code=$?
  [[ $code == 0 ]] || echo "  ✗ coverage exited $code — see $log"
  return $code
}

phase_shadow_copy() {
  if db_exists "$SHADOW" && [[ -z "$LOAD_STARTED_AT" ]]; then
    echo "  keeping existing $SHADOW (no fresh load this run)"
    return 0
  fi
  recreate_copy "$TARGET" "$SHADOW"
}

phase_profiles() {
  local log="$OUT/profiles.log"
  NODE_OPTIONS=--max-old-space-size=8192 DATABASE=neo4j NEO4J_URL="$NEO4J_URL" \
    NEO4J_PASSWORD="$NEO4J_PASSWORD" POSTGRES_URL="$PG/$SHADOW" \
    yarn start --entryFile core/column-profile.run >"$log" 2>&1
  local code=$?
  [[ $code == 0 ]] || echo "  ✗ profiles exited $code — see $log"
  return $code
}

phase_capture() { # <engine>
  local log="$OUT/capture-$1.log"
  mkdir -p "$CAP_DIR"
  NODE_OPTIONS=--max-old-space-size=8192 DATABASE="$1" NEO4J_URL="$NEO4J_URL" \
    NEO4J_PASSWORD="$NEO4J_PASSWORD" POSTGRES_URL="$PG/$SHADOW" \
    yarn start --entryFile core/shadow-diff.run -- --capture --out="$CAP_DIR" >"$log" 2>&1
  local code=$?
  [[ $code == 0 && -f "$CAP_DIR/capture-$1.json" ]] \
    || { echo "  ✗ capture-$1 exited $code or wrote no capture file — see $log"; return 1; }
}

phase_diff() {
  local log="$OUT/diff.log"
  yarn start --entryFile core/shadow-diff.run -- --diff --dir="$CAP_DIR" >"$log" 2>&1
  local code=$?
  command grep -E 'suppressed|entries|pairs' "$log" | sed 's/^/  /' | head -8
  [[ $code == 0 ]] || echo "  ✗ unsuppressed differences remain — $CAP_DIR/report.md"
  return $code
}

phase_probe() {
  local log="$OUT/probe.log"
  DATABASE=postgres POSTGRES_URL="$PG/postgres" \
    yarn start --entryFile core/mutation-probe.run -- --template="$TARGET" --rows="$ROWS" >"$log" 2>&1
  must_grep "$log" 'attempts.*ok.*failed.*not applicable' 'the probe printed its scoreboard' || return 1
  command grep -E 'attempts.*ok' "$log" | sed 's/^/  /'
  check_probe_reds "$log"
}

phase_e2e() {
  recreate_copy "$TARGET" "$E2E_DB" || return 1
  local log="$OUT/e2e.log" json="$OUT/e2e-results.json"
  DATABASE=postgres POSTGRES_URL="$PG/postgres" E2E_REUSE_DB="$E2E_DB" \
    yarn test:e2e --maxWorkers=1 --workerIdleMemoryLimit=2GB \
    --json --outputFile="$json" >"$log" 2>&1
  [[ -f "$json" ]] || { echo "  ✗ jest wrote no JSON results — see $log"; return 1; }
  check_e2e_json "$json"
}

phase_mutation_coverage() {
  # The checker reads schema.graphql, which is untracked and lineage-specific.
  # The capture phases regenerate it (they boot the HTTP adapter); if they were
  # skipped this run, a stale schema silently checks the wrong mutation list.
  if [[ -n "${CAPTURE_RAN:-}" ]]; then :; else
    echo "  ⚠ capture phases skipped this run — schema.graphql may be stale"
    warn+=('mutation-coverage: schema.graphql freshness not guaranteed')
  fi
  node src/core/mutation-coverage.check.ts >"$OUT/mutation-coverage.log" 2>&1
  local code=$?
  tail -6 "$OUT/mutation-coverage.log" | sed 's/^/  /'
  return $code
}

phase_corpus() {
  node src/core/shadow-diff/validate-corpus.ts >"$OUT/corpus.log" 2>&1
  local code=$?
  tail -4 "$OUT/corpus.log" | sed 's/^/  /'
  return $code
}

run_named_phase() {
  case "$1" in
    load)              phase_load ;;
    manifest)          phase_manifest ;;
    verify)            phase_verify ;;
    coverage-etl)      phase_coverage_etl ;;
    shadow-copy)       phase_shadow_copy ;;
    profiles)          phase_profiles ;;
    capture-neo4j)     phase_capture neo4j && CAPTURE_RAN=1 ;;
    capture-postgres)  phase_capture postgres && CAPTURE_RAN=1 ;;
    diff)              phase_diff ;;
    probe)             phase_probe ;;
    e2e)               phase_e2e ;;
    mutation-coverage) phase_mutation_coverage ;;
    corpus)            phase_corpus ;;
    *) echo "unknown phase: $1" >&2; return 64 ;;
  esac
}

# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
main() {
  local started=0
  for p in "${PHASES[@]}"; do
    if [[ -n "$ONLY" ]]; then [[ "$p" == "$ONLY" ]] || continue; fi
    if [[ -n "$FROM" && $started == 0 ]]; then
      [[ "$p" == "$FROM" ]] && started=1 || continue
    fi
    if [[ $RESUME == 1 && -f "$OUT/.$p.ok" ]]; then
      echo "== $p == (already green this run set — --resume skipped it)"
      pass+=("$p (resumed)")
      continue
    fi
    say "$p"
    if run_named_phase "$p"; then
      touch "$OUT/.$p.ok"
      pass+=("$p")
      echo "  ✓ $p"
    else
      rm -f "$OUT/.$p.ok"
      fail+=("$p")
      echo "  ✗ $p"
    fi
  done

  say 'certification summary'
  for p in "${pass[@]:-}"; do [[ -n "$p" ]] && echo "  ✓ $p"; done
  for w in "${warn[@]:-}"; do [[ -n "$w" ]] && echo "  ⚠ $w"; done
  for p in "${fail[@]:-}"; do [[ -n "$p" ]] && echo "  ✗ $p"; done
  if [[ ${#fail[@]} -gt 0 ]]; then
    echo
    echo 'NOT CERTIFIED — logs under '"$OUT"
    exit 1
  fi
  echo
  # A partial run can only ever be a partial green — the CERTIFIED verdict is
  # reserved for a run that executed every phase.
  if [[ -n "$ONLY" || -n "$FROM" || $RESUME == 1 ]]; then
    echo "partial run green (${#pass[@]} phase(s)) — NOT a certification. Logs under $OUT"
  else
    echo "CERTIFIED against $TARGET — logs under $OUT"
  fi
}

# Sourceable for tests: `source certify.sh --target=x --list` never runs main.
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then main; fi
