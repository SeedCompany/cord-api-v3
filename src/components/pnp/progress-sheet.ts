import { LazyGetter as Once } from 'lazy-get-decorator';
import { Column, Range, Row, Sheet, WorkBook } from '../../common/xlsx.util';

export abstract class ProgressSheet extends Sheet {
  static register(book: WorkBook) {
    const sheet = book.sheet('Progress');
    const isOBS = sheet.cell('P19').asString === 'Stories';
    const custom = isOBS
      ? new OralStoryingProgressSheet(sheet)
      : new WrittenScriptureProgressSheet(sheet);
    return book.registerCustomSheet(custom);
  }

  isWritten(): this is WrittenScriptureProgressSheet {
    return this instanceof WrittenScriptureProgressSheet;
  }
  isOBS(): this is OralStoryingProgressSheet {
    return this instanceof OralStoryingProgressSheet;
  }

  get stepLabels() {
    return this.range('R19:AB19');
  }

  get goals(): Range<ProgressSheet> {
    return this.range(this.goalsStart, this.goalsEnd);
  }
  @Once() protected get goalsStart() {
    return this.book.namedRange('ProgDraft').start;
  }
  @Once() protected get goalsEnd() {
    return this.sheetRange.end;
  }

  @Once() get totalVerseEquivalents() {
    const total = this.book.namedRange('VE').start.asNumber;
    if (!total) {
      throw new Error('Unable to find total verse equivalents in pnp file');
    }
    return total;
  }

  get summaryFiscalYears() {
    return this.namedRange('PrcntFinishedYears');
  }

  columnForQuarterSummary(fiscalQuarter: number) {
    return this.book.namedRange(`Q${fiscalQuarter}Column`).start.column;
  }
  get columnsForFiscalYear(): readonly [planned: Column, actual: Column] {
    const q4 = this.book.namedRange('Q4Column').start.column;
    return [q4.next(), q4.next(2)];
  }
  get columnsForCumulative(): readonly [planned: Column, actual: Column] {
    const q4 = this.book.namedRange('Q4Column').start.column;
    return [q4.next(3), q4.next(4)];
  }
}

export class WrittenScriptureProgressSheet extends ProgressSheet {
  @Once() get goalsEnd() {
    const lastRow = super.goalsEnd.row;
    let row = this.goalsStart.row;
    while (
      row < lastRow &&
      this.bookName(row) !== 'Other Goals and Milestones'
    ) {
      row = row.next();
    }
    return super.goalsEnd.column.cell(row);
  }

  bookName(goalRow: Row) {
    return this.cell('P', goalRow).asString;
  }
  totalVerses(goalRow: Row) {
    return this.cell('Q', goalRow).asNumber;
  }
}

export class OralStoryingProgressSheet extends ProgressSheet {
  storyName(goalRow: Row) {
    return this.cell('Q', goalRow).asString;
  }
  scriptureReference(goalRow: Row) {
    return this.cell('R', goalRow).asString;
  }
  composite(goalRow: Row) {
    return this.cell('S', goalRow).asString;
  }
}
