import { knownDeltas } from './known-deltas';
import { type DiffEntry, type DiffReport } from './types';

/** Cap for per-diff detail in the markdown; the JSON report is always full. */
const MAX_DETAILED_DIFFS = 500;
const MAX_SUPPRESSED_LISTED = 100;
const MAX_VALUE_LENGTH = 160;

const truncate = (value: unknown): string => {
  const str = JSON.stringify(value) ?? 'undefined';
  return str.length > MAX_VALUE_LENGTH
    ? `${str.slice(0, MAX_VALUE_LENGTH)}… (${str.length} chars)`
    : str;
};

const personaOrder = (report: DiffReport): string[] =>
  Object.keys(report.meta.neo4j.personas);

/**
 * Cell glyphs: `✓` identical · `D<n>` unsuppressed diffs · `S<n>` suppressed
 * · `E` errors-mismatch · `·` not executed for this persona.
 */
const summaryCell = (
  summary:
    | { diffs: number; suppressed: number; errorsMismatch: boolean }
    | undefined,
): string => {
  if (!summary) return '·';
  if (summary.diffs === 0 && summary.suppressed === 0) return '✓';
  const parts = [
    ...(summary.diffs > 0 ? [`D${summary.diffs}`] : []),
    ...(summary.suppressed > 0 ? [`S${summary.suppressed}`] : []),
    ...(summary.errorsMismatch ? ['E'] : []),
  ];
  return parts.join(' ');
};

const summaryTable = (report: DiffReport): string[] => {
  const personas = personaOrder(report);
  const ops = [...new Set(report.summaries.map((s) => s.op))].sort((a, b) =>
    a < b ? -1 : a > b ? 1 : 0,
  );
  const byOpPersona = new Map(
    report.summaries.map((s) => [`${s.op} ${s.persona}`, s]),
  );
  return [
    `| operation | ${personas.join(' | ')} |`,
    `|---|${personas.map(() => '---').join('|')}|`,
    ...ops.map(
      (op) =>
        `| \`${op}\` | ${personas
          .map((p) => summaryCell(byOpPersona.get(`${op} ${p}`)))
          .join(' | ')} |`,
    ),
  ];
};

const diffDetails = (diffs: readonly DiffEntry[]): string[] => {
  const lines: string[] = [];
  let currentGroup = '';
  for (const diff of diffs.slice(0, MAX_DETAILED_DIFFS)) {
    const group = `${diff.op} — ${diff.persona}`;
    if (group !== currentGroup) {
      currentGroup = group;
      lines.push('', `### \`${diff.op}\` — ${diff.persona}`, '');
    }
    lines.push(
      `- \`${diff.path || '(root)'}\``,
      `  - neo4j: \`${truncate(diff.neo4j)}\``,
      `  - postgres: \`${truncate(diff.postgres)}\``,
    );
  }
  if (diffs.length > MAX_DETAILED_DIFFS) {
    lines.push(
      '',
      `…and ${diffs.length - MAX_DETAILED_DIFFS} more — see report.json.`,
    );
  }
  return lines;
};

const suppressedSection = (report: DiffReport): string[] => {
  if (report.suppressed.length === 0) {
    return ['No diffs were suppressed.'];
  }
  const lines: string[] = [];
  const byRef = Map.groupBy(report.suppressed, (entry) => entry.suppressedBy!);
  for (const [ref, entries] of byRef) {
    const rule = knownDeltas.find((r) => r.ref === ref);
    lines.push('', `### ${ref} — ${entries.length} suppressed`, '');
    if (rule) lines.push(`> ${rule.reason}`, '');
    for (const entry of entries.slice(0, MAX_SUPPRESSED_LISTED)) {
      lines.push(
        `- \`${entry.op}\` · ${entry.persona} · \`${entry.path || '(root)'}\` — ` +
          `neo4j \`${truncate(entry.neo4j)}\` vs postgres \`${truncate(
            entry.postgres,
          )}\``,
      );
    }
    if (entries.length > MAX_SUPPRESSED_LISTED) {
      lines.push(
        `- …and ${entries.length - MAX_SUPPRESSED_LISTED} more — see report.json.`,
      );
    }
  }
  return lines;
};

/** The stdout summary (also the header of the markdown report). */
export const summaryLines = (report: DiffReport): string[] => {
  const { totals } = report;
  return [
    `Shadow-diff: neo4j (${report.meta.neo4j.capturedAt}) vs ` +
      `postgres (${report.meta.postgres.capturedAt})`,
    `  op × persona pairs:     ${totals.pairs}`,
    `  identical:              ${totals.identical}`,
    `  with UNSUPPRESSED diffs: ${totals.withDiffs} (${totals.diffCount} diff entries)`,
    `  suppressed-only:        ${totals.withSuppressedOnly} (${totals.suppressedCount} suppressed entries)`,
    `  instant-normalized values (same moment, different string form): ${totals.instantNormalized}`,
    totals.withDiffs === 0
      ? '  RESULT: PASS — no unsuppressed differences.'
      : '  RESULT: FAIL — unsuppressed differences found.',
  ];
};

export const renderMarkdown = (report: DiffReport): string => {
  const lines: string[] = [
    '# Shadow-diff report — Neo4j vs Postgres',
    '',
    ...summaryLines(report)
      .map((line) => line.trimStart())
      .map((line) => `- ${line}`),
    '',
    '## Summary (operation × persona)',
    '',
    'Legend: `✓` identical · `D<n>` unsuppressed diffs · `S<n>` suppressed ·',
    '`E` errors-mismatch',
    '',
    ...summaryTable(report),
    '',
    '## Unsuppressed diffs',
    ...(report.diffs.length === 0 ? ['', 'None.'] : diffDetails(report.diffs)),
    '',
    '## Suppressed (known deltas — counted, never silent)',
    ...suppressedSection(report),
    '',
  ];
  return lines.join('\n');
};
