import { LazyGetter as Once } from 'lazy-get-decorator';
import { CalendarDate, DateInterval, expandToFullFiscalYears } from '~/common';
import { Cell, Column, Range, Row, Sheet, WorkBook } from '~/common/xlsx.util';

export abstract class PlanningSheet extends Sheet {
  static register(book: WorkBook) {
    const sheet = book.sheet('Planning');
    const isOBS = sheet.cell('P19').asString === 'Stories';
    const custom = isOBS
      ? new OralStoryingPlanningSheet(sheet)
      : new WrittenScripturePlanningSheet(sheet);
    return book.registerCustomSheet(custom);
  }

  isWritten(): this is WrittenScripturePlanningSheet {
    return this instanceof WrittenScripturePlanningSheet;
  }
  isOBS(): this is OralStoryingPlanningSheet {
    return this instanceof OralStoryingPlanningSheet;
  }

  @Once() get revision() {
    return (
      this.revisionCell.asDate ?? CalendarDate.fromMillis(0).plus({ day: 1 })
    );
  }
  protected abstract revisionCell: Cell;

  @Once() get projectDateRange(): DateInterval {
    const { start, end } = this.projectDateCells;
    const range = DateInterval.tryFrom(start.asDate, end.asDate);
    if (!range) {
      throw new Error('Could not find project date range');
    }
    return range;
  }
  @Once() get projectFiscalYears(): DateInterval {
    return expandToFullFiscalYears(this.projectDateRange);
  }

  get projectDateCells() {
    return {
      start: this.projectStartDateCell,
      end: this.projectEndDateCell,
    };
  }
  protected abstract projectStartDateCell: Cell;
  protected abstract projectEndDateCell: Cell;

  abstract readonly stepLabels: Range;

  goalName(row: Row): Cell {
    const goal = this.isWritten()
      ? this.bookName(row)
      : this.isOBS()
      ? this.storyName(row)
      : undefined;
    if (!goal) {
      throw new Error('Could not determine goal name cell');
    }
    return goal;
  }

  @Once() protected get goalColumn() {
    return this.column('Q');
  }

  get goals(): Range<PlanningSheet> {
    return this.range(this.goalsStart, this.goalsEnd);
  }
  protected goalsStart = this.cell(this.goalColumn, 23);
  @Once() protected get goalsEnd() {
    return this.sheetRange.end.row.cell(this.goalColumn);
  }

  myNote(goalRow: Row, fallback = true) {
    const cell = this.myNotesColumn.cell(goalRow);
    return !fallback || cell.asString ? cell : this.myNotesFallbackCell ?? cell;
  }
  protected abstract myNotesFallbackCell: Cell | undefined;
  protected abstract myNotesColumn: Column;

  totalVerses(goalRow: Row) {
    return this.cell('T', goalRow);
  }
}

export class WrittenScripturePlanningSheet extends PlanningSheet {
  protected revisionCell = this.cell('Z11');
  protected projectStartDateCell = this.cell('Z14');
  protected projectEndDateCell = this.cell('Z15');
  readonly stepLabels = this.range('U18:Z18');
  protected myNotesColumn = this.column('AI');
  protected myNotesFallbackCell = this.cell('AI16');

  @Once() protected get goalColumn() {
    return this.revision > CalendarDate.local(2025, 2, 24)
      ? this.column('P')
      : this.column('Q');
  }

  bookName(goalRow: Row) {
    return this.cell(this.goalColumn, goalRow);
  }

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
}

export class OralStoryingPlanningSheet extends PlanningSheet {
  protected revisionCell = this.cell('X14');
  protected projectStartDateCell = this.cell('X16');
  protected projectEndDateCell = this.cell('X17');
  readonly stepLabels = this.range('U20:X20');
  protected myNotesColumn = this.column('Y');
  protected myNotesFallbackCell = undefined;

  storyName(goalRow: Row) {
    return this.cell(this.goalColumn, goalRow);
  }
  scriptureReference(goalRow: Row) {
    return this.cell('R', goalRow).asString;
  }
  composite(goalRow: Row) {
    return this.cell('S', goalRow).asString;
  }

  readonly sustainabilityGoals = this.range('Y17:AA20');
  sustainabilityRole(goalRow: Row) {
    return this.cell('Y', goalRow).asString;
  }
  sustainabilityRoleCount(goalRow: Row) {
    return this.cell('AA', goalRow).asNumber;
  }
}
