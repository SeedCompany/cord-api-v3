import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  Property,
} from '../../../core';
import { matchPropList } from '../../../core/database/query';
import {
  DbPropsOfDto,
  StandardReadResult,
} from '../../../core/database/results';
import { EthnologueLanguage, UpdateEthnologueLanguage } from '../dto';

type EthLangDbProps = DbPropsOfDto<EthnologueLanguage> & { id: ID };

@Injectable()
export class EthnologueLanguageRepository {
  constructor(private readonly db: DatabaseService) {}

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
      .apply(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<EthLangDbProps>>();

    return await query.first();
  }

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  getActualChanges(
    ethnologueLanguage: EthnologueLanguage,
    input: UpdateEthnologueLanguage
  ) {
    return this.db.getActualChanges(
      EthnologueLanguage,
      ethnologueLanguage,
      input
    );
  }

  async updateProperties(
    object: EthnologueLanguage,
    changes: UpdateEthnologueLanguage
  ) {
    return await this.db.updateProperties({
      type: EthnologueLanguage,
      object: object,
      changes,
    });
  }
}
