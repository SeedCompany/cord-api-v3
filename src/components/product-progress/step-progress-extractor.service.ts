import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { sumBy } from 'lodash';
import { CellObject, read, WorkBook, WorkSheet } from 'xlsx';
import {
  CalendarDate,
  fiscalYear,
  ID,
  NotFoundException,
  Session,
} from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
import { ACTIVE } from '../../core/database/query';
import { FileService, FileVersion } from '../file';
import { ProductListInput } from '../product/dto/list-product.dto';
import { MethodologyStep } from '../product/dto/methodology-step.enum';
import { ProductService } from '../product/product.service';
import { ProductProgressService } from './product-progress.service';

@Injectable()
export class StepProgressExtractor {
  constructor(
    private readonly files: FileService,
    private readonly db: DatabaseService,
    private readonly product: ProductService,
    private readonly service: ProductProgressService,
    @Logger('step-progress:extractor') private readonly logger: ILogger
  ) {}

  async extract(
    pnp: WorkBook,
    file: FileVersion,
    date: CalendarDate,
    reportId: ID,
    session: Session
  ) {
    const sheet = pnp.Sheets.Progress;
    if (!sheet) {
      this.logger.warning('Unable to find progress sheet in pnp file', {
        name: file.name,
        id: file.id,
      });
      return null;
    }

    const stepProgress = parseGoalsProgress(sheet, fiscalYear(date));
    if (!stepProgress) {
      this.logger.warning('Unable to parse step progress in pnp file');
      return null;
    }

    const engagementId = await this.getEngagementId(reportId);
    const goals = await this.product.list(
      {
        ...ProductListInput.defaultVal,
        filter: { engagementId },
      },
      session
    );

    for (const goal of goals.items) {
      // TODO: Validate all references share the same book
      const sameBook = goal.scriptureReferences.value.every(
        (el, _idx, arr) =>
          el.start.book === arr[0].start.book && el.end.book === arr[0].end.book
      );
      if (!sameBook) {
        this.logger.error('Goal references do not share the same book');
        continue;
      }

      const book = goal.scriptureReferences.value[0].start.book;
      const totalVerses = sumBy(
        goal.scriptureReferences.value,
        (verse) => verse.end.verse - verse.start.verse + 1
      );

      for (const step of stepProgress) {
        if (book === step.bookName && totalVerses === step.totalVerses) {
          await this.service.update(
            {
              productId: goal.id,
              reportId,
              steps: [
                {
                  step: MethodologyStep.BackTranslation,
                  completed: step.backTranslation,
                },
                {
                  step: MethodologyStep.ExegesisAndFirstDraft,
                  completed: step.exegesisAndFirstDraft,
                },
                {
                  step: MethodologyStep.ConsultantCheck,
                  completed: step.consultantCheck,
                },
                {
                  step: MethodologyStep.CommunityTesting,
                  completed: step.communityTesting,
                },
                {
                  step: MethodologyStep.TeamCheck,
                  completed: step.teamCheck,
                },
                {
                  step: MethodologyStep.Completed,
                  completed: step.completed,
                },
              ],
            },
            session
          );
        }
      }
    }

    return goals;
  }

  async readWorkbook(file: FileVersion) {
    const buffer = await this.files.downloadFileVersion(file.id);
    return read(buffer, { type: 'buffer' });
  }

  async getEngagementId(reportId: ID) {
    const result = await this.db
      .query()
      .match([
        node('eng', 'Engagement'),
        relation('out', '', 'report', ACTIVE),
        node('report', 'ProgressReport', { id: reportId }),
      ])
      .return<{ id: ID }>('eng.id as id')
      .first();

    if (!result) {
      throw new NotFoundException();
    }
    return result.id;
  }
}

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
    const exegesisAndFirstDraft = parseProgress(
      sheet[`R${i}`],
      sheet[`S${i}`],
      fiscalYear
    );
    const teamCheck = parseProgress(sheet[`T${i}`], sheet[`U${i}`], fiscalYear);
    const communityTesting = parseProgress(
      sheet[`V${i}`],
      sheet[`W${i}`],
      fiscalYear
    );
    const backTranslation = parseProgress(
      sheet[`X${i}`],
      sheet[`Y${i}`],
      fiscalYear
    );
    const consultantCheck = parseProgress(
      sheet[`Z${i}`],
      sheet[`AA${i}`],
      fiscalYear
    );
    const completed = parseProgress(
      sheet[`AB${i}`],
      sheet[`AB${i}`],
      fiscalYear
    );

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

const parseProgress = (
  stepProgress: CellObject,
  year: CellObject,
  fiscalYear: number
) => {
  return cellAsNumber(year) === fiscalYear
    ? parseStepProgress(stepProgress)
    : undefined;
};
