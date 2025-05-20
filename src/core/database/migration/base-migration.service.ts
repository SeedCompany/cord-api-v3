import { Inject, Injectable } from '@nestjs/common';
import { node, not, relation } from 'cypher-query-builder';
import { type DateTime } from 'luxon';
import {
  EnhancedResource,
  type ID,
  type MaybeUnsecuredInstance,
  type ResourceShape,
  type UnwrapSecured,
} from '~/common';
import { type DbChanges } from '~/core/database/changes';
import { ACTIVE, path } from '~/core/database/query';
import { ILogger, Logger } from '../../logger';
import { DatabaseService } from '../database.service';

/**
 * Each migration should be decorated with `@Migration()` decorator
 * that registers it as a migration (it also needs to be _provided_ in a module).
 *
 * The decorator asks for an ISO time that's used as the "DB schema's version."
 * This controls the order that the migrations are run and is referenced to
 * determine if the migration has already been ran or not. This date should
 * never be in the past.
 *
 * Migrations are currently ran directly after all the deployment of API servers.
 * This means it's safe to remove data that is no longer referenced as of the
 * commit the migration is in.
 * WARNING: This also means there's a short period of time where data could be
 * asked for but it has not been created/moved yet.
 */
@Injectable()
export abstract class BaseMigration {
  /** The class' version declared on the @Migration() decorator */
  version: DateTime;

  @Inject(DatabaseService)
  protected db: DatabaseService;

  @Logger('database:migration')
  protected logger: ILogger;

  abstract up(): Promise<void>;

  protected async addProperty<
    TResourceStatic extends ResourceShape<any>,
    TObject extends Partial<MaybeUnsecuredInstance<TResourceStatic>> & {
      id: ID;
    },
    Key extends keyof DbChanges<TObject> & string,
  >(
    resource: TResourceStatic | EnhancedResource<TResourceStatic>,
    property: Key,
    value: UnwrapSecured<TObject[Key]>,
  ) {
    resource = EnhancedResource.of(resource);

    const result = await this.db
      .query()
      .matchNode('node', resource.dbLabel)
      .where(
        not(
          path([
            node('node'),
            relation('out', '', property, ACTIVE),
            node('', 'Property'),
          ]),
        ),
      )
      .create([
        node('node'),
        relation('out', undefined, property, {
          ...ACTIVE,
          createdAt: this.version,
        }),
        node('newPropNode', resource.dbPropLabels[property], {
          createdAt: this.version,
          migration: this.version,
          value,
        }),
      ])
      .return<{ numPropsCreated: number }>(
        'count(newPropNode) as numPropsCreated',
      )
      .first();
    this.logger.info(
      `Created ${result?.numPropsCreated ?? 0} ${
        resource.name
      }.${property} default props`,
    );
  }
}
