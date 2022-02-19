import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { ID, Session } from '../../common';
import { DtoRepository } from '../../core';
import { createNode, paginate, sorting } from '../../core/database/query';
import { CreateEthnoArt, EthnoArt, EthnoArtListInput } from './dto';

@Injectable()
export class EthnoArtRepository extends DtoRepository(EthnoArt) {
  async checkEthnoArt(name: string) {
    return await this.db
      .query()
      .match([node('ethnoArt', 'EthnoArtName', { value: name })])
      .return('ethnoArt')
      .first();
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

  async list(input: EthnoArtListInput, _session: Session) {
    const result = await this.db
      .query()
      .matchNode('node', 'EthnoArt')
      .apply(sorting(EthnoArt, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
