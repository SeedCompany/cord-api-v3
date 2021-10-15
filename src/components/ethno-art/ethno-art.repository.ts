import { Injectable } from '@nestjs/common';
import { inArray, node } from 'cypher-query-builder';
import { ID, NotFoundException, Session } from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
import {
  createNode,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
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

  async create(input: CreateEthnoArt, session: Session) {
    const initialProps = {
      name: input.name,
      canDelete: true,
    };
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(EthnoArt, { initialProps }))
      .return<{ id: ID }>('node.id as id')
      .first();
  }

  async readOne(id: ID, session: Session) {
    const result = await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'EthnoArt', { id })])
      .apply(this.hydrate())
      .first();
    if (!result) {
      throw new NotFoundException('Could not find ethnoArt', 'ethnoArt.id');
    }
    return result.dto;
  }

  async readMany(ids: readonly ID[], session: Session) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .matchNode('node', 'EthoArt')
      .where({ 'node.id': inArray(ids.slice()) })
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  async list(input: EthnoArtListInput, session: Session) {
    const result = await this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('EthnoArt')])
      .apply(sorting(EthnoArt, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
