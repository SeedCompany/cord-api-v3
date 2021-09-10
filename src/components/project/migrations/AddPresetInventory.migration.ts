import { node, not, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '../../../core';
import { ACTIVE, createProperty, path } from '../../../core/database/query';
import { IProject } from '../dto';

@Migration('2021-09-09T22:49:00')
export class AddPresetInventoryMigration extends BaseMigration {
  async up() {
    const res = await this.db
      .query()
      .matchNode('node', 'Project')
      .where(
        not(
          path([
            node('node'),
            relation('out', '', 'presetInventory', ACTIVE),
            node('', 'Property'),
          ])
        )
      )
      .apply(
        createProperty({
          resource: IProject,
          key: 'presetInventory',
          value: false,
        })
      )
      .return<{ numPropsCreated: number }>(
        'sum(numPropsCreated) as numPropsCreated'
      )
      .first();
    this.logger.info(
      `Created ${res?.numPropsCreated ?? 0} preset inventory default props`
    );
  }
}
