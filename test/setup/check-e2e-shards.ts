/**
 * Run by the `E2E Tests` job in CI after every shard finishes:
 *
 *   node test/setup/check-e2e-shards.ts <results-dir> <timings-out>
 *
 * Proves the shards together ran every e2e spec file exactly once, and writes a
 * refreshed timings file from the run.
 *
 * Why this exists: a split that quietly leaves files out is the one failure
 * the shard jobs can't show — each shard only knows about its own files, and
 * every one of them goes green. This repo has already lost coverage that way
 * three times to an allowlist. So the list of expected files comes from git,
 * NOT from Jest's own discovery, and the check doesn't trust the sequencer.
 *
 * `<results-dir>` holds each shard's `jest --json` output, named
 * `e2e-results-<shard>-of-<total>.json`.
 *
 * Runs on Node's built-in type stripping with no dependencies, so the job
 * needs no `yarn install`.
 */
import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join, relative } from 'node:path';

interface JestJson {
  testResults: Array<{ name: string; startTime: number; endTime: number }>;
}

const [resultsDir, timingsOut] = process.argv.slice(2);
if (!resultsDir || !timingsOut) {
  process.stderr.write(
    'usage: check-e2e-shards.ts <results-dir> <timings-out>\n',
  );
  process.exit(2);
}

const errors: string[] = [];
const root = process.cwd();

const expected = execFileSync('git', ['ls-files', 'test'], { encoding: 'utf8' })
  .split('\n')
  .filter((file) => /\.e2e-spec\.tsx?$/.test(file));

const shardFiles = readdirSync(resultsDir)
  .map((file) => ({
    file,
    match: /^e2e-results-(\d+)-of-(\d+)\.json$/.exec(file),
  }))
  .filter((entry) => entry.match)
  .map(({ file, match }) => ({
    file,
    shard: Number(match![1]),
    total: Number(match![2]),
  }));

const totals = new Set(shardFiles.map((entry) => entry.total));
const total = Math.max(0, ...totals);
if (totals.size > 1) {
  errors.push(`Shards disagree on the shard count: ${[...totals].join(', ')}`);
}
for (const shard of Array.from({ length: total }, (_, index) => index + 1)) {
  if (!shardFiles.some((entry) => entry.shard === shard)) {
    errors.push(
      `Shard ${shard}/${total} reported no results (it crashed, was cancelled, or never started).`,
    );
  }
}
if (total === 0) {
  errors.push(`No shard results found in ${resultsDir}.`);
}

const seenIn = new Map<string, number[]>();
const timings: Record<string, number> = {};
const loads: string[] = [];
for (const { file, shard } of shardFiles.sort((a, b) => a.shard - b.shard)) {
  const json = JSON.parse(
    readFileSync(join(resultsDir, file), 'utf8'),
  ) as JestJson;
  let load = 0;
  for (const result of json.testResults) {
    const spec = relative(root, result.name).split('\\').join('/');
    seenIn.set(spec, [...(seenIn.get(spec) ?? []), shard]);
    const seconds = Math.max(
      1,
      Math.round((result.endTime - result.startTime) / 1000),
    );
    timings[spec] = seconds;
    load += seconds;
  }
  loads.push(`shard ${shard}: ${json.testResults.length} files, ${load}s`);
}

for (const spec of expected) {
  const shards = seenIn.get(spec);
  if (!shards) errors.push(`Never ran: ${spec}`);
  else if (shards.length > 1)
    errors.push(`Ran in more than one shard (${shards.join(', ')}): ${spec}`);
}
for (const spec of seenIn.keys()) {
  if (!expected.includes(spec))
    errors.push(`Ran but is not a tracked spec file: ${spec}`);
}

const sorted = Object.fromEntries(
  Object.entries(timings).sort(([a], [b]) => (a < b ? -1 : 1)),
);
writeFileSync(timingsOut, JSON.stringify(sorted, null, 2) + '\n');

const report = [
  `### E2E shard coverage`,
  '',
  `${expected.length} tracked spec files, ${seenIn.size} ran across ${total} shards.`,
  '',
  ...loads.map((line) => `- ${line}`),
  '',
  ...(errors.length
    ? ['**Coverage check FAILED:**', '', ...errors.map((line) => `- ${line}`)]
    : ['Every spec file ran exactly once.']),
].join('\n');
process.stdout.write(report + '\n');
if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, report + '\n');
}
for (const error of errors) process.stdout.write(`::error::${error}\n`);
process.exit(errors.length ? 1 : 0);
