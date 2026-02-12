import { LazyGetter as Once } from 'lazy-get-decorator';
import {
  fullFiscalQuarter,
  isQuarterNumber,
  isReasonableYear,
  Xlsx,
} from '~/common';

export abstract class ProgressSheet extends Xlsx.Sheet {
  static register(book: Xlsx.WorkBook) {
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

  get goals(): Xlsx.Range<ProgressSheet> {
    return this.range(this.goalsStart, this.goalsEnd);
  }
  protected abstract goalStartColumn: Xlsx.Column;
  @Once() protected get goalsStart() {
    return this.cell(
      this.goalStartColumn,
      this.book.namedRange('ProgDraft').start.row,
    );
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

  @Once() get reportingQuarter() {
    const year = this.reportingQuarterCells.year.asNumber!;
    const quarterStr = this.reportingQuarterCells.quarter.asString;
    const quarter = Number(quarterStr?.slice(1));
    return isReasonableYear(year) && isQuarterNumber(quarter)
      ? fullFiscalQuarter(quarter, year)
      : undefined;
  }
  @Once() get reportingQuarterCells() {
    return {
      quarter: this.namedRange('RptQtr').start,
      year: this.namedRange('RptYr').start,
    };
  }

  columnForQuarterSummary(fiscalQuarter: number) {
    return this.book.namedRange(`Q${fiscalQuarter}Column`).start.column;
  }
  get columnsForFiscalYear(): readonly [
    planned: Xlsx.Column,
    actual: Xlsx.Column,
  ] {
    const q4 = this.book.namedRange('Q4Column').start.column;
    return [q4.move(1), q4.move(2)];
  }
  get columnsForCumulative(): readonly [
    planned: Xlsx.Column,
    actual: Xlsx.Column,
  ] {
    const q4 = this.book.namedRange('Q4Column').start.column;
    return [q4.move(3), q4.move(4)];
  }
}

export class WrittenScriptureProgressSheet extends ProgressSheet {
  protected goalStartColumn = this.column('P');

  @Once() get goalsEnd() {
    const lastRow = super.goalsEnd.row;
    let row = this.goalsStart.row;
    while (
      row < lastRow &&
      this.bookName(row).asString !== 'Other Goals and Milestones'
    ) {
      row = row.move(1);
    }
    return super.goalsEnd.column.cell(row);
  }

  bookName(goalRow: Xlsx.Row) {
    return this.cell('P', goalRow);
  }
  totalVerses(goalRow: Xlsx.Row) {
    return this.cell('Q', goalRow);
  }
}

export class OralStoryingProgressSheet extends ProgressSheet {
  protected goalStartColumn = this.column('Q');

  storyName(goalRow: Xlsx.Row) {
    return this.cell('Q', goalRow);
  }
  scriptureReference(goalRow: Xlsx.Row) {
    return this.cell('R', goalRow).asString;
  }
  composite(goalRow: Xlsx.Row) {
    return this.cell('S', goalRow).asString;
  }
}
