import { mapOf } from '@seedcompany/common';
import { EventsHandler, ILogger, Logger } from '~/core';
import { ReportType } from '../../periodic-report/dto';
import { PeriodicReportUploadedEvent } from '../../periodic-report/events';
import { PnpProblemType } from '../../pnp/extraction-result';
import { ProductService } from '../../product';
import { ProducibleType, ProductStep } from '../../product/dto';
import { isScriptureEqual } from '../../scripture';
import { ProgressReportVariantProgress as Progress } from '../dto';
import { ProductProgressService } from '../product-progress.service';
import { StepNotPlannedException } from '../step-not-planned.exception';
import { StepProgressExtractor } from '../step-progress-extractor.service';

@EventsHandler(PeriodicReportUploadedEvent)
export class ExtractPnpProgressHandler {
  constructor(
    private readonly extractor: StepProgressExtractor,
    private readonly progress: ProductProgressService,
    private readonly products: ProductService,
    @Logger('step-progress:extractor') private readonly logger: ILogger,
  ) {}

  async handle(event: PeriodicReportUploadedEvent) {
    if (event.report.type !== ReportType.Progress) {
      return;
    }

    const result = event.pnpResult;

    // parse progress data from pnp spreadsheet
    let progressRows;
    try {
      progressRows = await this.extractor.extract(event.file, result);
    } catch (e) {
      this.logger.warning(e.message, {
        name: event.file.name,
        id: event.file.id,
        exception: e,
      });
      return;
    }
    if (progressRows.length === 0) {
      return;
    }

    // Fetch products for report mapped to a book/story name
    const engagementId = event.report.parent.properties.id;
    const storyProducts = progressRows[0].story
      ? await this.products.loadProductIdsWithProducibleNames(
          engagementId,
          ProducibleType.Story,
        )
      : mapOf({});
    const scriptureProducts = progressRows[0].bookName
      ? await this.products.loadProductIdsForBookAndVerse(
          engagementId,
          this.logger,
        )
      : [];

    // Convert row to product ID
    const updates = progressRows.flatMap((row) => {
      const { steps, ...rest } = row;
      if (row.story) {
        const productId = storyProducts.get(row.story);
        if (productId) {
          return { extracted: row, productId, steps };
        }
      }

      if (row.bookName) {
        const exactScriptureMatch = scriptureProducts.find(
          (ref) =>
            ref.scriptureRanges.length > 0 &&
            isScriptureEqual(ref.scriptureRanges, row.scripture),
        );
        if (exactScriptureMatch) {
          return { extracted: row, productId: exactScriptureMatch.id, steps };
        }

        const unspecifiedScriptureMatch = scriptureProducts.find(
          (ref) =>
            ref.book === row.bookName && ref.totalVerses === row.totalVerses,
        );
        if (unspecifiedScriptureMatch) {
          return {
            extracted: row,
            productId: unspecifiedScriptureMatch.id,
            steps,
          };
        }
      }

      this.logger.warning('Could not find product in pnp', {
        ...rest,
        report: event.report.id,
        file: event.file.id,
      });
      return [];
    });

    // Update progress for report & product
    await Promise.all(
      updates.map(async ({ extracted, ...input }) => {
        try {
          await this.progress.update({
            ...input,
            reportId: event.report.id,
            // TODO this seems fine for now as only this variant will upload PnPs.
            variant: Progress.FallbackVariant,
          });
        } catch (e) {
          if (
            !(
              e instanceof AggregateError &&
              e.message === 'Invalid Progress Input'
            )
          ) {
            throw e;
          }
          for (const error of e.errors) {
            if (!(error instanceof StepNotPlannedException)) {
              continue;
            }
            // kinda. close enough, I think, we give the cell ref as well.
            const goalLabel = extracted.bookName ?? extracted.story;
            result.addProblem(StepNotPlanned, extracted.cell, {
              goal: goalLabel,
              step: error.step,
            });
          }
        }
      }),
    );
  }
}

const StepNotPlanned = PnpProblemType.register({
  name: 'StepNotPlanned',
  severity: 'Error',
  render:
    (ctx: { goal: string; step: ProductStep }) =>
    ({ source }) => {
      const step = ProductStep.entry(ctx.step).label;
      return {
        groups: [
          'Step is not planned',
          `_${ctx.goal}_ has progress reported on steps that have not been declared to be worked in this engagement`,
        ],
        message: `_${ctx.goal}_ has not declared _${step}_ \`${source}\` as a step that will be worked in this engagement`,
      };
    },
  wiki: 'https://github.com/SeedCompany/cord-docs/wiki/PnP-Extraction-Validation:-Errors-and-Troubleshooting-Steps#9-step-is-not-planned',
});
