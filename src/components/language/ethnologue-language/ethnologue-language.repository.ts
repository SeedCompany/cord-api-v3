import { Injectable } from '@nestjs/common';
import { ID, Session } from '../../../common';
import { DtoRepository } from '../../../core';
import { createNode, matchRequestingUser } from '../../../core/database/query';
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
}
