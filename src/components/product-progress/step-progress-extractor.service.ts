import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { CellObject, read, WorkBook, WorkSheet } from 'xlsx';
import {
  CalendarDate,
  fiscalYear,
  ID,
  NotFoundException,
  Session,
} from '../../common';
import { DatabaseService, ILogger, Logger } from '../../core';
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
      const book = goal.scriptureReferences.value[0].start.book;
      for (const step of stepProgress) {
        if (book === step.bookName) {
          await this.service.update(
            {
              productId: goal.id,
              reportId,
              steps: [
                {
                  step: step.backTranslation.step,
                  completed: step.backTranslation.completed,
                },
                {
                  step: step.exegesisAndFirstDraft.step,
                  completed: step.exegesisAndFirstDraft.completed,
                },
                {
                  step: step.consultantCheck.step,
                  completed: step.consultantCheck.completed,
                },
                {
                  step: step.communityTesting.step,
                  completed: step.communityTesting.completed,
                },
                {
                  step: step.teamCheck.step,
                  completed: step.teamCheck.completed,
                },
                {
                  step: step.completed.step,
                  completed: step.completed.completed,
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
        relation('out', '', 'report', { active: true }),
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
    const exegesisAndFirstDraft = {
      step: MethodologyStep.ExegesisAndFirstDraft,
      completed: parseProgress(sheet[`R${i}`], sheet[`S${i}`], fiscalYear),
    };
    const teamCheck = {
      step: MethodologyStep.TeamCheck,
      completed: parseProgress(sheet[`T${i}`], sheet[`U${i}`], fiscalYear),
    };
    const communityTesting = {
      step: MethodologyStep.CommunityTesting,
      completed: parseProgress(sheet[`V${i}`], sheet[`W${i}`], fiscalYear),
    };
    const backTranslation = {
      step: MethodologyStep.BackTranslation,
      completed: parseProgress(sheet[`X${i}`], sheet[`Y${i}`], fiscalYear),
    };
    const consultantCheck = {
      step: MethodologyStep.ConsultantCheck,
      completed: parseProgress(sheet[`Z${i}`], sheet[`AA${i}`], fiscalYear),
    };
    const completed = {
      step: MethodologyStep.Completed,
      completed: parseProgress(sheet[`AB${i}`], sheet[`AB${i}`], fiscalYear),
    };

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
  year: CellObject,
  stepProgress: CellObject,
  fiscalYear: number
) => {
  return cellAsNumber(year) === fiscalYear
    ? parseStepProgress(stepProgress)
    : undefined;
};
