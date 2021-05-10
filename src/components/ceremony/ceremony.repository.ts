import { Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { Dictionary } from 'lodash';
import { DateTime } from 'luxon';
import {
  Session,
  ID,
  ServerException,
  generateId,
  Resource,
  Order,
  UnsecuredDto,
} from '../../common';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  matchSession,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchMemberRoles,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { QueryWithResult } from '../../core/database/query.overrides';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { NativeDbProps } from '../../core/database/results/types';
import { Role } from '../authorization';
import { BaseNode } from '../file';
import { Ceremony } from './dto';

@Injectable()
export class CeremonyRepository {
  constructor(private readonly db: DatabaseService) {}

  async create(session: Session, secureProps: Property[]): Promise<Query> {
    return this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(await generateId(), 'Ceremony', secureProps))
      .return('node.id as id');
  }

  // async readOne(
  //   id: ID,
  //   session: Session
  // ): Promise<
  //   | (StandardReadResult<
  //       NativeDbProps<Omit<UnsecuredDto<Ceremony>, keyof BaseNode>>
  //     > & {
  //       memberRoles: Role[];
  //     })
  //   | undefined
  // > {
  //   const readCeremony = this.db
  //     .query()
  //     .apply(matchRequestingUser(session))
  //     .match([node('node', 'Ceremony', { id })])
  //     .apply(matchPropList)
  //     .optionalMatch([
  //       node('project', 'Project'),
  //       relation('out', '', 'engagement', { active: true }),
  //       node('', 'Engagement'),
  //       relation('out', '', { active: true }),
  //       node('node', 'Ceremony', { id }),
  //     ])
  //     .with(['node', 'propList', 'project'])
  //     .apply(matchMemberRoles(session.userId))
  //     .return(['node', 'propList', 'memberRoles'])
  //     .asResult<
  //       StandardReadResult<DbPropsOfDto<Ceremony>> & {
  //         memberRoles: Role[];
  //       }
  //     >();
  //   const result = await readCeremony.first();

  //   return result;
  // }

  async checkDeletePermission(id: ID, session: Session): Promise<boolean> {
    return await this.db.checkDeletePermission(id, session);
  }
}
