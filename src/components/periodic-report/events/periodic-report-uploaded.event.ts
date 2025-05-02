import { LazyGetter as Once } from 'lazy-get-decorator';
import { type Session } from '~/common';
import { type Downloadable, type FileVersion } from '../../file/dto';
import { PnpProgressExtractionResult } from '../../pnp/extraction-result';
import { type PeriodicReport } from '../dto';

/**
 * Dispatched when a new file is uploaded for a periodic report
 */
export class PeriodicReportUploadedEvent {
  constructor(
    readonly report: PeriodicReport,
    readonly file: Downloadable<FileVersion>,
    readonly session: Session,
  ) {}

  pnpResultUsed = false;
  @Once() get pnpResult() {
    this.pnpResultUsed = true;
    return new PnpProgressExtractionResult(this.file.id);
  }
}
