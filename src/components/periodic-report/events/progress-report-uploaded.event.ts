import { Session } from '../../../common';
import { FileVersion } from '../../file';
import { ProgressReport } from '../dto';

/**
 * Dispatched when a new file is uploaded for a progress report
 */
export class PnpProgressUploadedEvent {
  constructor(
    readonly report: ProgressReport,
    readonly file: FileVersion,
    readonly session: Session
  ) {}
}
