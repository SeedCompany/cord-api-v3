import { Injectable } from '@nestjs/common';
import { ChangesOf } from '~/core/database/changes';
import { ID, Session } from '../../../common';
import { DtoRepository } from '../../../core';
import { createNode, matchRequestingUser } from '../../../core/database/query';
import {
  CreateEthnologueLanguage,
  EthnologueLanguage,
  UpdateEthnologueLanguage,
} from '../dto';

@Injectable()
export class EthnologueLanguageRepository extends DtoRepository(
  EthnologueLanguage,
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

  async update(
    existing: EthnologueLanguage,
    changes: ChangesOf<EthnologueLanguage, UpdateEthnologueLanguage>,
  ) {
    await this.updateProperties(existing, changes);
  }
}
