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
}
