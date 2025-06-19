import { WorkBook } from '~/common/xlsx.util';
import { type Downloadable, type FileVersion } from '../file/dto';
import { PlanningSheet } from './planning-sheet';
import { ProgressSheet } from './progress-sheet';

const ParsedPnp = Symbol('Parsed PnP');

export class Pnp {
  constructor(protected workbook: WorkBook, protected fileName?: string) {}

  /**
   * Create PnP from Downloadable.
   * Will reuse an existing instance from a previous call.
   */
  static async fromDownloadable(obj: Downloadable<FileVersion>) {
    const promise = obj.download() as Promise<Buffer> & { [ParsedPnp]?: Pnp };
    if (!promise[ParsedPnp]) {
      promise[ParsedPnp] = Pnp.fromBuffer(await promise, obj.name);
    }
    return promise[ParsedPnp]!;
  }

  static fromBuffer(buffer: Buffer, name?: string) {
    const book = WorkBook.fromBuffer(buffer);
    PlanningSheet.register(book);
    ProgressSheet.register(book);
    return new Pnp(book, name);
  }

  get planning() {
    return this.workbook.sheet<PlanningSheet>('Planning');
  }

  get progress() {
    return this.workbook.sheet<ProgressSheet>('Progress');
  }
}
