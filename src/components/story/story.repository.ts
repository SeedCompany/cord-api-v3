import { Injectable } from '@nestjs/common';
import { Query } from 'cypher-query-builder';
import { DbTypeOf } from '~/core/database/db-type';
import { ID, Session } from '../../common';
import { DatabaseService, DtoRepository } from '../../core';
import {
  createNode,
  matchProps,
  matchRequestingUser,
  merge,
  paginate,
  sorting,
} from '../../core/database/query';
import { ScriptureReferenceRepository } from '../scripture';
import { CreateStory, Story, StoryListInput } from './dto';

@Injectable()
export class StoryRepository extends DtoRepository(Story) {
  constructor(
    private readonly scriptureRefs: ScriptureReferenceRepository,
    db: DatabaseService,
  ) {
    super(db);
  }

  async create(input: CreateStory, session: Session) {
    const initialProps = {
      name: input.name,
      canDelete: true,
    };
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Story, { initialProps }))
      .return<{ id: ID }>('node.id as id')
      .first();
  }

  async list({ filter, ...input }: StoryListInput, _session: Session) {
    const result = await this.db
      .query()
      .matchNode('node', 'Story')
      .apply(sorting(Story, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .subQuery('node', this.scriptureRefs.list())
        .return<{ dto: DbTypeOf<Story> }>(
          merge('props', {
            scriptureReferences: 'scriptureReferences',
          }).as('dto'),
        );
  }
}
