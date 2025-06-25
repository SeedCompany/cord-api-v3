import { Injectable } from '@nestjs/common';
import { node, type Query, relation } from 'cypher-query-builder';
import {
  CreationFailed,
  type ID,
  NotFoundException,
  ReadAfterCreationFailed,
  type UnsecuredDto,
} from '~/common';
import { DtoRepository } from '~/core/database';
import {
  ACTIVE,
  createNode,
  createRelationships,
  matchProps,
  merge,
} from '~/core/database/query';
import { AllianceMembership, type CreateAllianceMembership } from './dto';

@Injectable()
export class AllianceMembershipRepository extends DtoRepository(
  AllianceMembership,
) {
  async create(input: CreateAllianceMembership) {
    const initialProps = {
      joinedAt: input.joinedAt,
      canDelete: true,
    };

    const result = await this.db
      .query()
      .apply(
        await createNode(AllianceMembership, {
          initialProps,
        }),
      )
      .apply(
        createRelationships(AllianceMembership, 'out', {
          member: ['Organization', input.memberId],
          alliance: ['Organization', input.allianceId],
        }),
      )
      .return<{ id: ID }>('node.id as id')
      .first();

    if (!result) {
      throw new CreationFailed(AllianceMembership);
    }

    return await this.readOne(result.id).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(AllianceMembership)
        : e;
    });
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .optionalMatch([
          node('node'),
          relation('out', '', 'member', ACTIVE),
          node('member', 'Organization'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'alliance', ACTIVE),
          node('alliance', 'Organization'),
        ])
        .return<{ dto: UnsecuredDto<AllianceMembership> }>(
          merge('props', {
            member: 'member { .id}',
            alliance: 'alliance { .id}',
          }).as('dto'),
        );
  }
}
