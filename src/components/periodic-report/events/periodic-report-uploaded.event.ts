import { Session } from '../../../common';
import { FileVersion } from '../../file';
import { PeriodicReport } from '../dto';

/**
 * Dispatched when a new file is uploaded for a periodic report
 */
export class PeriodicReportUploadedEvent {
  constructor(
    readonly report: PeriodicReport,
    readonly file: FileVersion,
    readonly session: Session
  ) {}
}
