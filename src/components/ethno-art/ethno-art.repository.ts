import { Injectable } from '@nestjs/common';
import { inArray, node } from 'cypher-query-builder';
import { ID, NotFoundException, Session } from '../../common';
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

  async readOne(id: ID, _session: Session) {
    const result = (await this.readMany([id], _session))[0];
    if (!result) {
      throw new NotFoundException('Could not find EthnoArt', 'ethnoArt.id');
    }
    return result;
  }

  async readMany(ids: readonly ID[], _session: Session) {
    return await this.db
      .query()
      .matchNode('node', 'EthnoArt')
      .where({ 'node.id': inArray(ids.slice()) })
      .apply(this.hydrate())
      .map('dto')
      .run();
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
