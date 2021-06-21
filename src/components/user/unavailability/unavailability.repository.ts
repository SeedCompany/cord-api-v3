import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../../core';
import { matchPropList } from '../../../core/database/query';
import {
  DbPropsOfDto,
  StandardReadResult,
} from '../../../core/database/results';
import {
  Unavailability,
  UnavailabilityListInput,
  UpdateUnavailability,
} from './dto';

@Injectable()
export class UnavailabilityRepository extends DtoRepository(Unavailability) {
  async create(session: Session, secureProps: Property[]) {
    const createUnavailability = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(await generateId(), 'Unavailability', secureProps))
      .return('node.id as id')
      .asResult<{ id: ID }>();

    return await createUnavailability.first();
  }

  async connectUnavailability(id: ID, userId: ID) {
    const query = `
    MATCH (user: User {id: $userId}),
    (unavailability:Unavailability {id: $id})
    CREATE (user)-[:unavailability {active: true, createdAt: datetime()}]->(unavailability)
    RETURN  unavailability.id as id
    `;
    await this.db
      .query()
      .raw(query, {
        userId,
        id,
      })
      .run();
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Unavailability', { id })])
      .apply(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<DbPropsOfDto<Unavailability>>>();

    return await query.first();
  }

  async getUserIdByUnavailability(
    session: Session,
    input: UpdateUnavailability
  ) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([
        node('user', 'User'),
        relation('out', '', 'unavailability', { active: true }),
        node('unavailability', 'Unavailability', { id: input.id }),
      ])
      .return<{ id: ID }>('user.id as id')
      .first();
  }

  async list(
    { page, count, sort, order, filter }: UnavailabilityListInput,
    session: Session
  ) {
    return await this.db.list<Unavailability>({
      session,
      nodevar: 'unavailability',
      aclReadProp: 'canReadUnavailabilityList',
      aclEditProp: 'canCreateUnavailability',
      props: ['description', 'start', 'end'],
      input: {
        page,
        count,
        sort,
        order,
        filter,
      },
    });
  }
}
