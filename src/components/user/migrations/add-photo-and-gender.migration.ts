import { node, relation } from 'cypher-query-builder';
import { BaseMigration, Migration } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  randomUUID,
  variable,
} from '~/core/database/query';
import { File } from '../../file/dto';
import { User } from '../dto';

@Migration('2025-09-30T09:00:00')
export class AddGenderAndPhotoMigration extends BaseMigration {
  async up() {
    await this.addProperty(User, 'gender', null);

    await this.db
      .query()
      .matchNode('creator', 'RootUser')
      .matchNode('user', 'User')
      .raw('WHERE NOT (user)-[:photo { active: true }]->(:Property)')
      .create([
        node('user'),
        relation('out', undefined, 'photo', {
          ...ACTIVE,
          createdAt: this.version,
        }),
        node('idHolder', 'Property', {
          createdAt: this.version,
          migration: this.version,
          value: variable(randomUUID()),
        }),
      ])
      .with('creator, user, idHolder')
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
          in: { photoNode: variable('user') },
          out: { createdBy: variable('creator') },
        }),
      )
      .return('count(user)')
      .executeAndLogStats();
  }
}
