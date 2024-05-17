import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { ID, PublicOf, ServerException } from '~/common';
import { CommonRepository } from '~/core/database';
import { ACTIVE, INACTIVE } from '~/core/database/query';
import { ProjectStep } from '../dto';
import { ProjectRulesRepository } from './project.rules.repository';

@Injectable()
export class ProjectRulesNeo4jRepository
  extends CommonRepository
  implements PublicOf<ProjectRulesRepository>
{
  async getCurrentStep(id: ID, changeset?: ID) {
    let currentStep;
    if (changeset) {
      const result = await this.db
        .query()
        .match([
          node('project', 'Project', { id }),
          relation('out', '', 'step', INACTIVE),
          node('step', 'Property'),
          relation('in', '', 'changeset', ACTIVE),
          node('', 'Changeset', { id: changeset }),
        ])
        .raw('return step.value as step')
        .asResult<{ step: ProjectStep }>()
        .first();
      currentStep = result?.step;
    }
    if (!currentStep) {
      const result = await this.db
        .query()
        .match([
          node('project', 'Project', { id }),
          relation('out', '', 'step', ACTIVE),
          node('step', 'Property'),
        ])
        .raw('return step.value as step')
        .asResult<{ step: ProjectStep }>()
        .first();
      currentStep = result?.step;
    }

    if (!currentStep) {
      throw new ServerException('current step not found');
    }

    return currentStep;
  }

  async getProjectTeamUserIds(id: ID): Promise<ID[]> {
    const users = await this.db
      .query()
      .match([
        node('', 'Project', { id }),
        relation('out', '', 'member', ACTIVE),
        node('', 'ProjectMember'),
        relation('out', '', 'user', ACTIVE),
        node('user', 'User'),
      ])
      .return<{ ids: ID[] }>('collect(user.id) as ids')
      .first();
    return users?.ids ?? [];
  }

  /** A list of the project's previous steps ordered most recent to furthest in the past */
  async getPreviousSteps(id: ID, changeset?: ID): Promise<ProjectStep[]> {
    const result = await this.db
      .query()
      .match([
        ...(changeset
          ? [
              node('changeset', 'Changeset', { id: changeset }),
              relation('in', '', 'changeset', ACTIVE),
            ]
          : []),
        node('node', 'Project', { id }),
        relation('out', '', 'step', changeset ? undefined : INACTIVE),
        node('prop'),
      ])
      .apply((q) =>
        changeset
          ? q.raw('WHERE NOT (changeset)-[:changeset {active:true}]->(prop)')
          : q,
      )
      .with('prop')
      .orderBy('prop.createdAt', 'DESC')
      .return<{ steps: ProjectStep[] }>(`collect(prop.value) as steps`)
      .first();
    if (!result) {
      throw new ServerException("Failed to determine project's previous steps");
    }
    return result.steps;
  }
}
