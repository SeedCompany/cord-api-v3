import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
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
    id: ID,
    valueSet: Dictionary<string | number | undefined>
  ) {
    const query = this.db
      .query()
      .match([
        node('ethnologueLanguage', 'EthnologueLanguage', {
          id: id,
        }),
      ])
      .match([
        [
          node('ethnologueLanguage'),
          relation('out', '', 'code', { active: true }),
          node('code', 'Property'),
        ],
        [
          node('ethnologueLanguage'),
          relation('out', '', 'provisionalCode', { active: true }),
          node('provisionalCode', 'Property'),
        ],
        [
          node('ethnologueLanguage'),
          relation('out', '', 'name', { active: true }),
          node('name', 'Property'),
        ],
        [
          node('ethnologueLanguage'),
          relation('out', '', 'population', { active: true }),
          node('population', 'Property'),
        ],
      ])
      .setValues(valueSet);
    await query.run();
  }
}
