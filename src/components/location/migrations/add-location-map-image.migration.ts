import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core';
import {
  ACTIVE,
  createNode,
  createRelationships,
  variable,
} from '~/core/database/query';
import { File } from '../../file/dto';

@Migration('2023-03-30T16:30:00')
export class AddLocationMapImageMigration extends BaseMigration {
  async up() {
    await this.db
      .query()
      .matchNode('user', 'RootUser')
      .matchNode('location', 'Location')
      .raw('WHERE NOT (location)-[:mapImage { active: true }]->(:Property)')
      .create([
        node('location'),
        relation('out', undefined, 'mapImage', {
          ...ACTIVE,
          createdAt: this.version,
        }),
        node('idHolder', 'Property', {
          createdAt: this.version,
          migration: this.version,
          value: variable('apoc.create.uuid()'),
        }),
      ])
      .with('user, location, idHolder')
      .apply(
        await createNode(File, {
          baseNodeProps: {
            id: variable('idHolder.value'),
            createdAt: this.version,
            migration: this.version,
          },
          initialProps: { public: true },
        }),
      )
      .apply(
        createRelationships(File, {
          in: { mapImageNode: variable('location') },
          out: { createdBy: variable('user') },
        }),
      )
      .return('count(location)')
      .executeAndLogStats();
  }
}
