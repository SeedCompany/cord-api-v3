import { InputException, NotFoundException, Xlsx } from '~/common';
import { type Downloadable, type FileVersion } from '../file/dto';
import { PlanningSheet } from './planning-sheet';
import { ProgressSheet } from './progress-sheet';

const ParsedPnp = Symbol('Parsed PnP');

export class Pnp {
  constructor(
    protected workbook: Xlsx.WorkBook,
    protected fileName?: string,
  ) {}

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
    const book = Xlsx.WorkBook.fromBuffer(buffer);
    PlanningSheet.register(book);
    ProgressSheet.register(book);
    return new Pnp(book, name);
  }

  get planning() {
    return this.sheet<PlanningSheet>('Planning');
  }

  get progress() {
    return this.sheet<ProgressSheet>('Progress');
  }

  protected sheet<TSheet extends Xlsx.Sheet>(name: string): TSheet {
    try {
      return this.workbook.sheet(name);
    } catch (e) {
      if (e instanceof NotFoundException && this.fileName?.match(/\bUBT\b/)) {
        throw new NotPnPFile(
          `It appears you are uploading a _budget_ excel file, not a _PnP_ file.`,
          e,
        );
      }
      throw e;
    }
  }
}

export class NotPnPFile extends InputException {}
