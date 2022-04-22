import { isNull, node, relation } from 'cypher-query-builder';
import { asyncPool, ID } from '../../../common';
import { BaseMigration, IEventBus, Migration } from '../../../core';
import { ACTIVE } from '../../../core/database/query';
import { FileService } from '../../file';
import { PeriodicReportService } from '../../periodic-report';
import { PeriodicReportUploadedEvent } from '../../periodic-report/events';

@Migration('2021-10-05T08:53:22')
export class PnpCaptureSummaryForMultiplePeriodsMigration extends BaseMigration {
  constructor(
    private readonly files: FileService,
    private readonly reports: PeriodicReportService,
    private readonly eventBus: IEventBus
  ) {
    super();
  }

  async up() {
    const result = await this.findSummariesWithoutPeriod();
    this.logger.info(
      `Found ${result.length} reports with summaries without a period`
    );

    const session = this.fakeAdminSession;

    // Re-extract pnp progress for all results
    await asyncPool(2, result, async (row, i) => {
      this.logger.debug(`Re-extracting PnP ${i} / ${result.length}`);

      try {
        const [report, fv] = await Promise.all([
          this.reports.readOne(row.reportId, session),
          this.files.getFileVersion(row.versionId, session),
        ]);
        const file = this.files.asDownloadable(fv);

        const event = new PeriodicReportUploadedEvent(report, file, session);
        await this.eventBus.publish(event);
      } catch (e) {
        this.logger.error('Failed to re-extract PnP', {
          report: row.reportId,
          file: row.versionId,
          exception: e,
        });
      }
    });

    await this.deleteOldSummariesWithoutPeriods();
  }

  private async findSummariesWithoutPeriod() {
    const result = await this.db
      .query()
      .match([
        node('r', 'ProgressReport'),
        relation('out', '', 'summary', ACTIVE),
        node('ps', 'ProgressSummary'),
      ])
      .where({
        ps: { period: isNull() },
      })
      .with('distinct r')
      .subQuery('r', (sub) =>
        sub
          .match([
            node('r'),
            relation('out', '', 'reportFileNode'),
            node('', 'File'),
            relation('out', '', 'child', ACTIVE),
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

  private async deleteOldSummariesWithoutPeriods() {
    await this.db
      .query()
      .matchNode('ps', 'ProgressSummary')
      .where({
        ps: { period: isNull() },
      })
      .detachDelete('ps')
      .run();
  }
}
