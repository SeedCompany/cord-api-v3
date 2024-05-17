import { Injectable } from '@nestjs/common';
import { ID } from '~/common';
import { CommonRepository, e } from '~/core/edgedb';
import { ProjectStep } from '../dto';

@Injectable()
export class ProjectRulesRepository extends CommonRepository {
  async getCurrentStep(id: ID, _changeset?: ID): Promise<ProjectStep> {
    const project = e.select(e.cast(e.Project, e.cast(e.uuid, id)));
    return await this.db.run(project.step);
  }

  //TODO:  Still needs to be tested
  async getProjectTeamUserIds(id: ID) {
    const project = e.select(e.cast(e.Project, e.cast(e.uuid, id)));
    return (await this.db.run(project.members.user)).map((u) => u.id);
  }

  //TODO: I need help figuring out how to implement this method
  async getPreviousSteps(id: ID, _changeset?: ID): Promise<ProjectStep[]> {
    const project = e.select(e.cast(e.Project, e.cast(e.uuid, id)), () => ({
      previousSteps: [
        {
          step: true,
          stepChangedAt: true,
          order_by: { stepChangedAt: 'desc' },
        },
      ],
    }));
    const { previousSteps } = await this.db.run(project);
    return previousSteps;
  }
}
