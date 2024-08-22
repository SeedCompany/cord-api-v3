import { mapEntries, nonEnumerable } from '@seedcompany/common';
import { Iterable } from 'ix';
import { LazyGetter as Once } from 'lazy-get-decorator';
import { assert } from 'ts-essentials';
import {
  CellAddress,
  Range as LibRange,
  WorkBook as LibWorkBook,
  read,
  utils,
} from 'xlsx';
import type { CellObject, WorkSheet } from 'xlsx';
import { CalendarDate } from './temporal';

export class WorkBook {
  private readonly book: LibWorkBook;
  private readonly sheets: Record<string, Sheet> = {};
  protected constructor(book: LibWorkBook | WorkBook) {
    this.book = book instanceof WorkBook ? book.book : book;
    nonEnumerable(this, 'book' as any, 'sheets' as any);
  }

  static fromBuffer(buffer: Buffer) {
    const book = read(buffer, {
      type: 'buffer',
      cellDates: true,
    });
    return new WorkBook(book);
  }

  sheet<TSheet extends Sheet>(name: string): TSheet {
    return (this.sheets[name] ??
      (this.sheets[name] = new Sheet(this, name))) as TSheet;
  }

  registerCustomSheet(sheet: Sheet) {
    this.sheets[sheet.name] = sheet;
    if (!Object.getOwnPropertyDescriptor(this, 'namedRanges')) {
      return;
    }
    for (const [rangeName, range] of Object.entries(this.namedRanges)) {
      if (range.sheet.name === sheet.name) {
        this.namedRanges[rangeName] = sheet.range(range);
      }
    }
    return sheet;
  }

  namedRange(name: string): Range {
    const found = this.namedRanges[name];
    if (!found) {
      throw new Error(`Could not find named range: ${name}`);
    }
    return found;
  }
  @Once() private get namedRanges(): Record<string, Range> {
    const rawList = this.book.Workbook?.Names ?? [];
    return mapEntries(rawList, ({ Ref: ref, Name: name }, { SKIP }) => {
      const matched = /^'?([^']+)'?!([$\dA-Z]+(?::[$\dA-Z]+)?)$/.exec(ref);
      return matched ? [name, this.sheet(matched[1]).range(matched[2])] : SKIP;
    }).asRecord;
  }
}

export class Sheet {
  readonly book: WorkBook;
  readonly name: string;
  private readonly workbook: LibWorkBook;
  private readonly sheet: WorkSheet;

  constructor(sheet: Sheet);
  constructor(workbook: WorkBook, name: string);
  constructor(arg: WorkBook | Sheet, name?: string) {
    if (arg instanceof Sheet) {
      this.book = arg.book;
      this.workbook = arg.workbook;
      this.sheet = arg.sheet;
      this.name = arg.name;
    } else {
      this.name = name!;
      this.book = arg;
      // @ts-expect-error yeah it's private this seems like the easiest way though
      this.workbook = this.book.book;
      this.sheet = this.workbook.Sheets[this.name];
      if (!this.sheet) {
        throw new Error(`Cannot find ${this.name} sheet`);
      }
    }
    nonEnumerable(this, 'workbook' as any, 'sheet' as any);
  }

  @Once() get hidden() {
    return (
      (this.workbook.Workbook?.Sheets?.find((s) => s.name === this.name)
        ?.Hidden ?? 0) > 0
    );
  }

  @Once() get sheetRange() {
    const ref = this.sheet['!ref'];
    assert(ref, 'Cannot find sheet range reference');
    return this.range(ref);
  }

  namedRange(name: string) {
    const range = this.book.namedRange(name);
    if (range.sheet.name !== this.name) {
      throw new Error(`Named range references a different sheet: ${name}`);
    }
    return range.sheet === this ? (range as Range<this>) : this.range(range);
  }

  range(a1range: string | Range | LibRange): Range<this>;
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  range(start: Cell | string, end: Cell | string): Range<this>;
  range(a1start: Cell | string | Range | LibRange, a1end?: Cell | string) {
    if (a1start instanceof Range) {
      return new Range(this, this.cell(a1start.start), this.cell(a1start.end));
    }
    const { s, e } = a1end
      ? { s: a1start as Cell | string, e: a1end }
      : typeof a1start === 'object'
      ? (a1start as LibRange)
      : utils.decode_range(a1start);
    return new Range(
      this,
      s instanceof Cell ? s : this.cell(s),
      e instanceof Cell ? e : this.cell(e),
    );
  }

  row(a1row: number) {
    return new Row(this, a1row);
  }

  column(column: string) {
    return new Column(this, column);
  }

  /**
   * Grab cell from decoded range. Note that both column & row are 0-indexed
   * here.
   */
  cell(columnIndex: number, rowIndex: number): Cell<this>;
  /**
   * Grab cell from A1 column & A1 row (1-indexed).
   */
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  cell(column: string | Column, a1row: number | Row): Cell<this>;
  /**
   * Grab cell from an existing cell.
   * This cell could be from another sheet, but the one returned will be
   * for this sheet.
   */
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  cell(address: Cell): Cell<this>;
  /**
   * Grab cell from an encoded or decoded address.
   */
  // eslint-disable-next-line @typescript-eslint/unified-signatures
  cell(address: string | CellAddress): Cell<this>;
  cell(
    column: string | number | CellAddress | Column | Cell,
    row?: number | Row,
  ) {
    if (column instanceof Cell) {
      return new Cell(
        this,
        this.sheet,
        this.sheet[column.toString()],
        column.address,
      );
    }
    if (column instanceof Column) {
      column = column.a1;
    }
    if (row != null && row instanceof Row) {
      row = row.a1;
    }
    if (row == null || typeof column === 'object') {
      const address =
        typeof column === 'string'
          ? utils.decode_cell(column)
          : (column as CellAddress);
      column = utils.encode_col(address.c);
      row = address.r + 1;
    } else if (typeof column === 'number') {
      column = utils.encode_col(column);
      row++;
    }

    const address = `${column}${row}`;
    return new Cell(
      this,
      this.sheet,
      this.sheet[address],
      utils.decode_cell(address),
    );
  }
}

export class Cell<TSheet extends Sheet = Sheet> {
  constructor(
    readonly sheet: TSheet,
    private readonly libSheet: WorkSheet,
    private readonly cell: CellObject | undefined,
    readonly address: CellAddress,
  ) {
    nonEnumerable(this, 'libSheet' as any);
  }

  @Once() get row() {
    return this.sheet.row(this.address.r + 1);
  }

  @Once() get column() {
    return this.sheet.column(utils.encode_col(this.address.c));
  }

  @Once() get hidden() {
    const colHidden = this.libSheet['!cols']?.[this.address.c].hidden ?? false;
    const rowHidden = this.libSheet['!rows']?.[this.address.r].hidden ?? false;
    return colHidden || rowHidden;
  }

  moveX(step: number) {
    return this.sheet.cell(this.column.move(step), this.row);
  }
  moveY(step: number) {
    return this.sheet.cell(this.column, this.row.move(step));
  }

  get exists() {
    return !!this.cell;
  }
  get isNumber() {
    return this.cell?.t === 'n';
  }
  @Once() get asNumber() {
    return this.cell && this.cell.t === 'n' && typeof this.cell.v === 'number'
      ? this.cell.v
      : undefined;
  }
  @Once() get asString() {
    return this.cell && this.cell.t === 's' && typeof this.cell.v === 'string'
      ? this.cell.v
      : undefined;
  }
  @Once() get asDate() {
    return this.cell && this.cell.t === 'd' && this.cell.v instanceof Date
      ? CalendarDate.fromJSDate(this.cell.v)
      : undefined;
  }

  get fqn() {
    return `${this.sheet.name}!${this.ref}`;
  }
  get ref() {
    return `${this.column.a1}${this.row.a1}`;
  }
  toString() {
    return this.ref;
  }
}

abstract class Rangable<TSheet extends Sheet = Sheet> {
  constructor(readonly sheet: TSheet) {}

  abstract get start(): Cell<TSheet>;
  abstract get end(): Cell<TSheet>;

  /**
   * Iterate through the rows in this range.
   * Cell column is always the starting column.
   */
  walkDown(): Iterable<Cell<TSheet>> {
    return Iterable.from(
      function* (this: Rangable<TSheet>) {
        let current = this.start.row;
        while (current <= this.end.row) {
          const cell = current.cell(this.start.column);
          if (cell.exists) {
            yield cell;
          }
          current = current.move(1);
        }
      }.call(this),
    );
  }

  /**
   * Iterate through the columns in this range.
   * Cell row is always the starting row.
   */
  walkRight(): Iterable<Cell<TSheet>> {
    return Iterable.from(
      function* (this: Rangable<TSheet>) {
        let current = this.start.column;
        while (current <= this.end.column) {
          const cell = current.cell(this.start.row);
          if (cell.exists) {
            yield cell;
          }
          current = current.move(1);
        }
      }.call(this),
    );
  }

  get ref() {
    return `${this.sheet.name}!${this.start.toString()}:${this.end.toString()}`;
  }
  toString() {
    return this.ref;
  }
}

export class Range<TSheet extends Sheet = Sheet> extends Rangable<TSheet> {
  constructor(
    sheet: TSheet,
    readonly start: Cell<TSheet>,
    readonly end: Cell<TSheet>,
  ) {
    super(sheet);
  }
}

export class Row<TSheet extends Sheet = Sheet> extends Rangable<TSheet> {
  /** A1 row number (1-indexed) */
  readonly a1: number;
  readonly index: number;

  constructor(sheet: TSheet, row: number) {
    super(sheet);
    this.a1 = row;
    this.index = row - 1;
  }

  @Once() get start(): Cell<TSheet> {
    const full = this.sheet.sheetRange;
    return this.sheet.cell(full.start.column, this.a1);
  }

  @Once() get end(): Cell<TSheet> {
    const full = this.sheet.sheetRange;
    return this.sheet.cell(full.start.column, this.a1);
  }

  cell(column: string | Column) {
    return this.sheet.cell(column, this.a1);
  }

  move(step: number) {
    return new Row(this.sheet, this.a1 + step);
  }

  /**
   * @internal Used for comparison operators
   * @deprecated
   */
  valueOf() {
    return this.index;
  }
}

export class Column<TSheet extends Sheet = Sheet> extends Rangable<TSheet> {
  /** A1 column letter */
  readonly a1: string;
  readonly index: number;

  constructor(sheet: TSheet, column: string) {
    super(sheet);
    this.a1 = column;
    this.index = utils.decode_col(this.a1);
  }

  @Once() get start(): Cell<TSheet> {
    const full = this.sheet.sheetRange;
    return this.sheet.cell(this.a1, full.start.row);
  }

  @Once() get end(): Cell<TSheet> {
    const full = this.sheet.sheetRange;
    return this.sheet.cell(this.a1, full.start.row);
  }

  cell(row: number | Row) {
    return this.sheet.cell(this.a1, row);
  }

  move(step: number) {
    return new Column(this.sheet, utils.encode_col(this.index + step));
  }

  /**
   * @internal Used for comparison operators
   * @deprecated
   */
  valueOf() {
    return this.index;
  }
}
