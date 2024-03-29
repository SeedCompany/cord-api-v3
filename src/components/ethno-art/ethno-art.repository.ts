import { Injectable } from '@nestjs/common';
import { Query } from 'cypher-query-builder';
import { ChangesOf } from '~/core/database/changes';
import { ID, Session } from '../../common';
import { DbTypeOf, DtoRepository } from '../../core';
import {
  createNode,
  matchProps,
  merge,
  paginate,
  sorting,
} from '../../core/database/query';
import { ScriptureReferenceRepository } from '../scripture';
import {
  CreateEthnoArt,
  EthnoArt,
  EthnoArtListInput,
  UpdateEthnoArt,
} from './dto';

@Injectable()
export class EthnoArtRepository extends DtoRepository(EthnoArt) {
  constructor(private readonly scriptureRefs: ScriptureReferenceRepository) {
    super();
  }
  async create(input: CreateEthnoArt, _session: Session) {
    const initialProps = {
      name: input.name,
      canDelete: true,
    };
    return await this.db
      .query()
      .apply(await createNode(EthnoArt, { initialProps }))
      .return<{ id: ID }>('node.id as id')
      .first();
  }

  async update(
    existing: EthnoArt,
    simpleChanges: Omit<
      ChangesOf<EthnoArt, UpdateEthnoArt>,
      'scriptureReferences'
    >,
  ) {
    await this.updateProperties(existing, simpleChanges);
  }

  async list(input: EthnoArtListInput, _session: Session) {
    const result = await this.db
      .query()
      .matchNode('node', 'EthnoArt')
      .apply(sorting(EthnoArt, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .subQuery('node', this.scriptureRefs.list())
        .return<{ dto: DbTypeOf<EthnoArt> }>(
          merge('props', {
            scriptureReferences: 'scriptureReferences',
          }).as('dto'),
        );
  }
}
