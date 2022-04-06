import { greaterThan, node, relation } from 'cypher-query-builder';
import { asyncPool, ID } from '../../../common';
import { BaseMigration, IEventBus, Migration } from '../../../core';
import { ACTIVE } from '../../../core/database/query';
import { FileService } from '../../file';
import { PeriodicReportService } from '../../periodic-report';
import { PnpProgressUploadedEvent } from '../../periodic-report/events';

@Migration('2021-10-05T09:53:22')
export class PnpHandleTotalVerseEquivalentsMigration extends BaseMigration {
  constructor(
    private readonly files: FileService,
    private readonly reports: PeriodicReportService,
    private readonly eventBus: IEventBus
  ) {
    super();
  }

  async up() {
    const result = await this.findSummariesWithValuesGreaterThanOne();
    this.logger.info(
      `Found ${result.length} reports with summaries whose values were incorrectly extracted as percents`
    );

    const session = this.fakeAdminSession;

    // Re-extract pnp progress for all results
    await asyncPool(2, result, async (row, i) => {
      this.logger.info(`Re-extracting PnP ${i} / ${result.length}`);

      try {
        const [report, fv] = await Promise.all([
          this.reports.readOne(row.reportId, session),
          this.files.getFileVersion(row.versionId, session),
        ]);
        const file = this.files.asDownloadable(fv);

        const event = new PnpProgressUploadedEvent(report, file, session);
        await this.eventBus.publish(event);
      } catch (e) {
        this.logger.error('Failed to re-extract PnP', {
          report: row.reportId,
          file: row.versionId,
          exception: e,
        });
      }
    });
  }

  private async findSummariesWithValuesGreaterThanOne() {
    const result = await this.db
      .query()
      .match([
        node('r', 'ProgressReport'),
        relation('out', '', 'summary', ACTIVE),
        node('ps', 'ProgressSummary'),
      ])
      .where({
        ps: { planned: greaterThan(1) },
      })
      .with('distinct r')
      .subQuery('r', (sub) =>
        sub
          .match([
            node('r'),
            relation('out', '', 'reportFileNode'),
            node('', 'File'),
            relation('in', '', 'parent', ACTIVE),
            node('version', 'FileVersion'),
          ])
          .return('version')
          .orderBy('version.createdAt', 'DESC')
          .raw('LIMIT 1')
      )
      .return<{ reportId: ID; versionId: ID }>([
        'r.id as reportId',
        'version.id as versionId',
      ])
      .run();
    return result;
  }
}
