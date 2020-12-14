import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { node, relation } from 'cypher-query-builder';
import { AnonSession, ServerException, Session } from '../../common';
import { DatabaseService } from '../../core';
import { EngagementStatusTransition, SecuredEngagementStatus } from './dto';
import { EngagementRules } from './engagement.rules';

@Resolver(SecuredEngagementStatus)
export class EngagementStatusResolver {
  constructor(
    private readonly engagementRules: EngagementRules,
    private readonly db: DatabaseService
  ) {}

  @ResolveField(() => [EngagementStatusTransition], {
    description: 'The available statuses a engagement can be transitioned to.',
  })
  async transitions(
    @Parent() status: SecuredEngagementStatus & { engagementId?: string },
    @AnonSession() session: Session
  ): Promise<EngagementStatusTransition[]> {
    if (!status.engagementId) {
      throw new ServerException(
        'Engagement ID should have been provided by Engagement resolver'
      );
    }
    if (!status.canRead || !status.value) {
      return [];
    }
    const projectRes = await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id: status.engagementId }),
        relation('in', '', 'engagement'),
        node('project', 'Project'),
      ])
      .return('project.id as projectId')
      .asResult<{ projectId: string }>()
      .first();
    if (!projectRes) {
      throw new ServerException('Engagement is not associated with a project');
    }
    return await this.engagementRules.getAvailableTransitions(
      status.engagementId,
      projectRes.projectId,
      session
    );
  }
}
