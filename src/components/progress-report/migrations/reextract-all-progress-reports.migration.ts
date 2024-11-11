import { asyncPool } from '@seedcompany/common';
import { node, relation } from 'cypher-query-builder';
import { IEventBus } from '~/core';
import { BaseMigration, Migration } from '~/core/database';
import { ACTIVE, matchProps, merge } from '~/core/database/query';
import { FileService } from '../../file';
import { FileVersion } from '../../file/dto';
import { PeriodicReportUploadedEvent } from '../../periodic-report/events';
import { ProgressReport } from '../dto';

@Migration('2024-11-11T16:00:06')
export class ReextractPnpProgressReportsMigration extends BaseMigration {
  constructor(
    private readonly eventBus: IEventBus,
    private readonly files: FileService,
  ) {
    super();
  }

  async up() {
    const session = this.fakeAdminSession;
    const pnps = createPaginator((page) =>
      this.grabSomePnpsToReextract(page, 100),
    );
    await asyncPool(2, pnps, async ({ dto: report, fv }) => {
      try {
        const pnp = this.files.asDownloadable(fv);
        const event = new PeriodicReportUploadedEvent(report, pnp, session);
        await this.db.conn.runInTransaction(() => this.eventBus.publish(event));
      } catch (e) {
        this.logger.error('Failed to re-extract PnP', {
          report: report.id,
          fvId: fv.id,
          exception: e,
        });
      }
    });
  }

  private async grabSomePnpsToReextract(page: number, size: number) {
    this.logger.info(`Grabbing page of progress reports ${page}`);

    const currentPage = await this.db
      .query()
      // eslint-disable-next-line no-loop-func
      .subQuery((s) =>
        s
          .match(node('report', 'ProgressReport'))
          // Grab latest pnp file version, ignore reports without
          .subQuery('report', (sub) =>
            sub
              .match([
                node('report'),
                relation('out', '', 'reportFileNode', ACTIVE),
                node('', 'File'),
                relation('in', '', 'parent', ACTIVE),
                node('version', 'FileVersion'),
                relation('out', '', 'name', ACTIVE),
                node('name', 'Property'),
              ])
              .return(merge('version', { name: 'name.value' }).as('fv'))
              .orderBy('fv.createdAt', 'DESC')
              .raw('LIMIT 1'),
          )
          .return(['report, fv'])
          .orderBy('fv.createdAt')
          .skip(page * size)
          .limit(size),
      )
      .match([
        node('parent', 'BaseNode'),
        relation('out', '', 'report', ACTIVE),
        node('report'),
      ])
      .apply(matchProps({ nodeName: 'report' }))
      .return<{
        // These are close enough lol
        dto: ProgressReport;
        fv: FileVersion;
      }>([merge('props', { parent: 'parent' }).as('dto'), 'fv'])
      .run();
    return currentPage;
  }
}

export async function* createPaginator<T>(
  getPage: (page: number) => Promise<readonly T[]>,
) {
  let page = 0;
  do {
    const currentPage = await getPage(page);
    if (currentPage.length === 0) {
      return;
    }
    yield* currentPage;
    page++;
    // eslint-disable-next-line no-constant-condition
  } while (true);
}
