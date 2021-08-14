import { Injectable } from '@nestjs/common';
import { CellObject, read, WorkBook, WorkSheet } from 'xlsx';
import { CalendarDate, fiscalQuarter, fiscalYear } from '../../common';
import { ILogger, Logger } from '../../core';
import { FileService, FileVersion } from '../file';
import { ProgressSummary as Progress } from './dto';

@Injectable()
export class ProgressExtractor {
  constructor(
    private readonly files: FileService,
    @Logger('progress:extractor') private readonly logger: ILogger
  ) {}

  extract(pnp: WorkBook, file: FileVersion, date: CalendarDate) {
    const sheet = pnp.Sheets.Progress;
    if (!sheet) {
      this.logger.warning('Unable to find progress sheet in pnp file', {
        name: file.name,
        id: file.id,
      });
      return null;
    }

    const yearRow = findFiscalYearRow(sheet, fiscalYear(date));
    if (!yearRow) {
      this.logger.warning('Unable to find fiscal year in pnp file', {
        name: file.name,
        id: file.id,
      });
      return null;
    }

    const quarterCol = ['AH', 'AI', 'AJ', 'AK'][fiscalQuarter(date) - 1];
    return {
      reportPeriod: this.summaryFrom(sheet, yearRow, quarterCol, quarterCol),
      fiscalYear: this.summaryFrom(sheet, yearRow, 'AL', 'AM'),
      cumulative: this.summaryFrom(sheet, yearRow, 'AN', 'AO'),
    };
  }

  extractStepProgress(pnp: WorkBook, file: FileVersion, date: CalendarDate) {
    const sheet = pnp.Sheets.Progress;
    if (!sheet) {
      this.logger.warning('Unable to find progress sheet in pnp file', {
        name: file.name,
        id: file.id,
      });
    }
    const stepProgress = parseGoalsProgress(sheet, fiscalYear(date));
    if (!stepProgress) {
      this.logger.warning('Unable to find step progress in pnp file');
    }

    return stepProgress;
  }

  async readWorkbook(file: FileVersion) {
    const buffer = await this.files.downloadFileVersion(file.id);
    return read(buffer, { type: 'buffer' });
  }

  private summaryFrom(
    sheet: WorkSheet,
    fiscalYearRow: number,
    plannedColumn: string,
    actualColumn: string
  ): Progress | null {
    const planned = cellAsNumber(sheet[`${plannedColumn}${fiscalYearRow}`]);
    const actual = cellAsNumber(sheet[`${actualColumn}${fiscalYearRow}`]);
    return planned && actual ? { planned, actual } : null;
  }
}

const findFiscalYearRow = (sheet: WorkSheet, fiscalYear: number) => {
  let i = 20;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const cell: CellObject = sheet[`AG${i}`];
    if (cellAsNumber(cell) === fiscalYear) {
      return i;
    }
    if (!cell || cell.t !== 'n') {
      return null;
    }
    i++;
  }
};

const parseGoalsProgress = (sheet: WorkSheet, fiscalYear: number) => {
  let i = 23;
  const goalsProgress = [];
  // eslint-disable-next-line no-constant-condition
  while (true) {
    if (
      cellAsString(sheet[`P${i}`]) === 'Other Goals and Milestones' ||
      !cellAsString(sheet[`P${i}`])
    ) {
      return goalsProgress;
    }

    const bookName = cellAsString(sheet[`P${i}`]);
    const totalVerses = cellAsNumber(sheet[`Q${i}`]);
    const exegesisAndFirstDraft = parse(
      sheet[`R${i}`],
      sheet[`S${i}`],
      fiscalYear
    );
    const teamCheck = parse(sheet[`T${i}`], sheet[`U${i}`], fiscalYear);
    const communityTesting = parse(sheet[`V${i}`], sheet[`W${i}`], fiscalYear);
    const backTranslation = parse(sheet[`X${i}`], sheet[`Y${i}`], fiscalYear);
    const consultantCheck = parse(sheet[`Z${i}`], sheet[`AA${i}`], fiscalYear);
    const completed = parse(sheet[`AB${i}`], sheet[`AB${i}`], fiscalYear);

    goalsProgress.push({
      bookName,
      totalVerses,
      exegesisAndFirstDraft,
      teamCheck,
      communityTesting,
      backTranslation,
      consultantCheck,
      completed,
    });
    i++;
  }
};

const cellAsNumber = (cell: CellObject) =>
  cell && cell.t === 'n' && typeof cell.v === 'number' ? cell.v : undefined;

const cellAsString = (cell: CellObject) =>
  cell && cell.t === 's' && typeof cell.v === 'string' ? cell.v : undefined;

const parseStepProgress = (cell: CellObject) =>
  cell && cell.t === 's' && typeof cell.v === 'string' && cell.v.startsWith('Q')
    ? 100.0
    : cellAsNumber(cell);

const parse = (
  year: CellObject,
  stepProgress: CellObject,
  fiscalYear: number
) => {
  return cellAsNumber(year) === fiscalYear
    ? parseStepProgress(stepProgress)
    : undefined;
};
