import { ModuleRef } from '@nestjs/core';
import { node, relation } from 'cypher-query-builder';
import { asyncPool, ID } from '../../../common';
import { BaseMigration, IEventBus, Migration } from '../../../core';
import { ACTIVE } from '../../../core/database/query';
import { EngagementRepository } from '../../engagement/engagement.repository';
import { EngagementUpdatedEvent } from '../../engagement/events';
import { ProductMethodology as Methodology } from '../dto';

@Migration('2021-11-26T18:13:01')
export class ReextractPlanningPnpsMigration extends BaseMigration {
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly eventBus: IEventBus,
  ) {
    super();
  }

  async up() {
    const rows = await this.grabAllPnpsToReextract();
    this.logger.info(
      `Found ${rows.length} eligible PnPs that can be re-extracted to create products`,
    );

    const engagementRepo = this.moduleRef.get(EngagementRepository);
    const session = this.fakeAdminSession;
    await asyncPool(2, rows, async (row, i) => {
      this.logger.info(`Re-extracting PnP ${i} / ${rows.length}`);

      try {
        const engagement = await engagementRepo.readOne(row.engId, session);
        const event = new EngagementUpdatedEvent(
          engagement,
          engagement,
          {
            id: engagement.id,
            pnp: {
              uploadId: row.pnpFileId,
            },
            methodology:
              row.methodologies.length > 1
                ? Methodology.Paratext
                : row.methodologies[0],
          },
          session,
        );
        await this.eventBus.publish(event);
      } catch (e) {
        this.logger.error('Failed to re-extract PnP', {
          engagement: row.engId,
          pnpId: row.pnpFileId,
          exception: e,
        });
      }
    });
  }

  private async grabAllPnpsToReextract() {
    const res = await this.db
      .query()
      .matchNode('eng', 'LanguageEngagement')
      // Only active engagements
      .raw(
        'WHERE (eng)-[:status { active: true }]->(:Property { value: "Active" })',
      )
      // Grab latest pnp file version, ignore engagements without
      .subQuery('eng', (sub) =>
        sub
          .match([
            node('eng'),
            relation('out', '', 'pnpNode', ACTIVE),
            node('', 'File'),
            relation('in', '', 'parent', ACTIVE),
            node('version', 'FileVersion'),
          ])
          .return('version')
          .orderBy('version.createdAt', 'DESC')
          .raw('LIMIT 1'),
      )
      // Grab all unique methodologies from engagement's products, ignore engagements without
      .subQuery('eng', (sub) =>
        sub
          .match([
            node('eng'),
            relation('out', '', 'product', ACTIVE),
            node('', 'DirectScriptureProduct'),
            relation('out', '', 'methodology', ACTIVE),
            node('methodology', 'Property'),
          ])
          .with([
            'keys(apoc.coll.frequenciesAsMap(collect(methodology.value))) as methodologies',
          ])
          .raw('WHERE size(methodologies) > 0')
          .return('methodologies'),
      )
      .return<{ engId: ID; pnpFileId: ID; methodologies: Methodology[] }>([
        'eng.id as engId',
        'version.id as pnpFileId',
        'methodologies',
      ])
      .run();
    return res;
  }
}
