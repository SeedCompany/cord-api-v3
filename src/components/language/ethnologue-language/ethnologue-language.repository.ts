import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../../core';
import { matchProps } from '../../../core/database/query';
import { DbPropsOfDto } from '../../../core/database/results';
import { EthnologueLanguage } from '../dto';

@Injectable()
export class EthnologueLanguageRepository extends DtoRepository(
  EthnologueLanguage
) {
  async create(secureProps: Property[], session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(
        createBaseNode(await generateId(), 'EthnologueLanguage', secureProps)
      )
      .return('node.id as id');

    return await query.first();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'EthnologueLanguage', { id: id })])
      .apply(matchProps())
      .return('props')
      .asResult<{ props: DbPropsOfDto<EthnologueLanguage> }>();

    return await query.first();
  }
}
