import type { ID } from '~/common';
import type { TransitionName } from '../transitions';

/**
 * Everything the workflow does with each ingest trigger: the transition it
 * attempts, and the phrase explaining why — used in the workflow event's note
 * and the notification email.
 *
 * Future ingest triggers (auto-translation complete, AI draft complete — see
 * #3767) each become one entry here once the system producing them exists.
 * Entries must map to transitions with a `from` status — the auto-advance
 * handler enforces this to guarantee a report is never moved backwards or
 * re-advanced by a repeated delivery.
 */
export const IngestTriggers = {
  DataReceived: {
    transition: 'Start',
    description: 'report data was received',
  },
} satisfies Record<string, { transition: TransitionName; description: string }>;

export type ProgressReportIngestTrigger = keyof typeof IngestTriggers;

/**
 * An automated source (currently Rev79) delivered data for a progress report.
 * Fired by ingest paths, inside their transaction, so the workflow can react —
 * e.g. auto-advance the report's status.
 */
export class ProgressReportIngestTriggerHook {
  constructor(
    readonly reportId: ID<'ProgressReport'>,
    readonly trigger: ProgressReportIngestTrigger,
    /**
     * Human-readable name of the system that delivered the data, e.g. "Rev79".
     * Surfaces in the workflow event's notes and the notification email.
     */
    readonly source: string,
  ) {}
}
