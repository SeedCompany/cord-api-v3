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
}
