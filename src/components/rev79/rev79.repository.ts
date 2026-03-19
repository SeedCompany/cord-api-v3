import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { type ID } from '~/common';
import { CommonRepository } from '~/core/neo4j';
import { ACTIVE } from '~/core/neo4j/query';

@Injectable()
export class Rev79Repository extends CommonRepository {
  /**
   * Returns IDs of all projects whose rev79ProjectId property matches.
   * Uniqueness is not enforced in the schema, so multiple results are possible;
   * the service layer checks for that condition.
   */
  async findProjectsByRev79Id(
    rev79ProjectId: string,
  ): Promise<ReadonlyArray<{ id: ID<'Project'> }>> {
    return await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'rev79ProjectId', ACTIVE),
        node('', 'Property', { value: rev79ProjectId }),
      ])
      .return<{ id: ID<'Project'> }>('project.id as id')
      .run();
  }

  /**
   * Returns IDs of all LanguageEngagements within `projectId` whose
   * rev79CommunityId property matches.
   * The service layer enforces that exactly one result is returned.
   */
  async findEngagementsByRev79CommunityId(
    projectId: ID<'Project'>,
    rev79CommunityId: string,
  ): Promise<ReadonlyArray<{ id: ID<'LanguageEngagement'> }>> {
    return await this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'engagement', ACTIVE),
        node('engagement', 'LanguageEngagement'),
        relation('out', '', 'rev79CommunityId', ACTIVE),
        node('', 'Property', { value: rev79CommunityId }),
      ])
      .return<{ id: ID<'LanguageEngagement'> }>('engagement.id as id')
      .run();
  }
}
