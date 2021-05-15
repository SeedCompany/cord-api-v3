import { Injectable } from '@nestjs/common';
import { Node, node, Relation, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';

import {
  CalendarDate,
  generateId,
  ID,
  Sensitivity,
  Session,
  UnsecuredDto,
} from '../../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  matchSession,
  Property,
  property,
} from '../../../core';
import { DbChanges } from '../../../core/database/changes';
import {
  calculateTotalAndPaginateList,
  collect,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../../core/database/query';
import {
  DbPropsOfDto,
  BaseNode,
  PropListDbResult,
  StandardReadResult,
} from '../../../core/database/results';
import {
  CreateEthnologueLanguage,
  EthnologueLanguage,
  UpdateEthnologueLanguage,
} from '../dto';
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
