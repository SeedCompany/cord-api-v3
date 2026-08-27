/**
 * Compare a fresh load's loss manifest against the committed baseline.
 *
 *     node src/core/cutover/compare-loss-manifest.ts <baseline.json> <fresh.json>
 *
 * The A4 premise (Apples to Apples plan): a healthy load's loss profile is
 * STABLE across source snapshots — the same guard drops, the same
 * not-hydrated labels, the same blank-fill columns, in counts that barely
 * move. So the check is comparative, not absolute:
 *
 *   ✗ a key the baseline does not have  → a NEW loss cause. Regression.
 *   ✗ a count above the baseline        → a loss that GREW. Regression.
 *   ~ a count below the baseline        → an improvement; reported, and the
 *     baseline should be re-committed deliberately so the next run is held
 *     to the better number.
 *   ✗ a baseline key missing entirely   → also a finding: either the loss
 *     was fixed (re-baseline) or the reporting stopped counting it, and the
 *     second must not pass silently.
 *
 * For blank fills the tally compares `filled`, and a `mode` change
 * (invented ↔ blank) is a schema-decision change and flags on its own.
 *
 * No app boot — pure file comparison. Exit 1 on any regression.
 */
import { readFileSync } from 'fs';

/**
 * Structural copy of cutover.harness's LossManifest rather than an import:
 * this script runs under bare `node` (type stripping), which does not
 * resolve the app's extensionless imports — and the JSON file on disk is
 * the actual contract between the two.
 */
interface LossManifest {
  readonly dropped: Readonly<Record<string, number>>;
  readonly notHydrated: Readonly<Record<string, number>>;
  readonly defaulted: Readonly<
    Record<
      string,
      {
        readonly filled: number;
        readonly seen: number;
        readonly mode: string;
        readonly fallback: string;
      }
    >
  >;
  readonly totals: {
    readonly dropped: number;
    readonly notHydrated: number;
    readonly lost: number;
  };
}

// eslint-disable-next-line no-console
const log = (message: string) => console.log(message);

const [baselinePath, freshPath] = process.argv.slice(2);
if (!baselinePath || !freshPath) {
  log(
    'Usage: node src/core/cutover/compare-loss-manifest.ts ' +
      '<baseline.json> <fresh.json>',
  );
  process.exit(1);
}

const read = (file: string): LossManifest =>
  JSON.parse(readFileSync(file, 'utf8')) as LossManifest;
const baseline = read(baselinePath);
const fresh = read(freshPath);

let regressions = 0;
let improvements = 0;

const compareCounts = (
  section: string,
  base: Readonly<Record<string, number>>,
  next: Readonly<Record<string, number>>,
): void => {
  const keys = [...new Set([...Object.keys(base), ...Object.keys(next)])].sort(
    (a, b) => a.localeCompare(b),
  );
  for (const key of keys) {
    const before = base[key];
    const after = next[key];
    if (before === undefined) {
      regressions++;
      log(`✗ NEW ${section} ${key} — ${after!} row(s); no baseline entry.`);
    } else if (after === undefined) {
      regressions++;
      log(
        `✗ GONE ${section} ${key} — baseline had ${before}, fresh run ` +
          'reports nothing. Fixed? Re-baseline. Stopped counting? Find out.',
      );
    } else if (after > before) {
      regressions++;
      log(`✗ GREW ${section} ${key} — ${before} → ${after}`);
    } else if (after < before) {
      improvements++;
      log(`~ shrank ${section} ${key} — ${before} → ${after}`);
    }
  }
};

compareCounts('dropped', baseline.dropped, fresh.dropped);
compareCounts('not-hydrated', baseline.notHydrated, fresh.notHydrated);

const fillKeys = [
  ...new Set([
    ...Object.keys(baseline.defaulted),
    ...Object.keys(fresh.defaulted),
  ]),
].sort((a, b) => a.localeCompare(b));
for (const key of fillKeys) {
  const before = baseline.defaulted[key];
  const after = fresh.defaulted[key];
  if (!before) {
    regressions++;
    log(`✗ NEW blank-fill ${key} — ${after!.filled} filled (${after!.mode})`);
  } else if (!after) {
    regressions++;
    log(
      `✗ GONE blank-fill ${key} — baseline had ${before.filled}; fixed? ` +
        're-baseline. Stopped counting? Find out.',
    );
  } else {
    if (after.mode !== before.mode) {
      regressions++;
      log(
        `✗ MODE CHANGE ${key} — ${before.mode} → ${after.mode}: a schema ` +
          'decision moved; verify it was deliberate (migration 0042 class).',
      );
    }
    if (after.filled > before.filled) {
      regressions++;
      log(`✗ GREW blank-fill ${key} — ${before.filled} → ${after.filled}`);
    } else if (after.filled < before.filled) {
      improvements++;
      log(`~ shrank blank-fill ${key} — ${before.filled} → ${after.filled}`);
    }
  }
}

log(
  `\nBaseline totals lost ${baseline.totals.lost} vs fresh ` +
    `${fresh.totals.lost} — ${regressions} regression(s), ` +
    `${improvements} improvement(s).` +
    (improvements > 0 && regressions === 0
      ? ' Re-commit the fresh manifest as the baseline to hold the gain.'
      : ''),
);
process.exit(regressions > 0 ? 1 : 0);
