import { Injectable, Scope } from '@nestjs/common';
import { ID, ObjectView } from '../../common';
import { ObjectViewAwareLoader } from '../../core';
import { IProject, Project } from './dto';
import { ProjectService } from './project.service';

@Injectable({ scope: Scope.REQUEST })
export class ProjectLoader extends ObjectViewAwareLoader<IProject> {
  constructor(private readonly projects: ProjectService) {
    super();
  }

  async loadManyByView(
    ids: readonly ID[],
    view: ObjectView
  ): Promise<readonly Project[]> {
    return await this.projects.readMany(ids, this.session, view);
  }
}
