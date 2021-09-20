import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { ID, NotFoundException, Session } from '../../../common';
import { DtoRepository, matchRequestingUser } from '../../../core';
import { createNode } from '../../../core/database/query';
import { CreateEthnologueLanguage, EthnologueLanguage } from '../dto';

@Injectable()
export class EthnologueLanguageRepository extends DtoRepository(
  EthnologueLanguage
) {
  async create(input: CreateEthnologueLanguage, session: Session) {
    const initialProps = {
      code: input.code,
      provisionalCode: input.provisionalCode,
      name: input.name,
      population: input.population,
    };

    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(EthnologueLanguage, { initialProps }))
      .return<{ id: ID }>('node.id as id');

    return await query.first();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'EthnologueLanguage', { id: id })])
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find ethnologue language',
        'ethnologue.id'
      );
    }
    return result.dto;
  }
}
