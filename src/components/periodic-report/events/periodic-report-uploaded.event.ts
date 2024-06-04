import { Session } from '~/common';
import { Downloadable, FileNode } from '../../file/dto';
import { PeriodicReport } from '../dto';

/**
 * Dispatched when a new file is uploaded for a periodic report
 */
export class PeriodicReportUploadedEvent {
  constructor(
    readonly report: PeriodicReport,
    readonly file: Downloadable<FileNode>,
    readonly session: Session,
  ) {}
}
