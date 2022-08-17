import { ID, ObjectView } from '../../common';
import { LoaderFactory, ObjectViewAwareLoader } from '../../core';
import {
  InternshipProject,
  IProject,
  Project,
  TranslationProject,
} from './dto';
import { ProjectService } from './project.service';

@LoaderFactory(() => [IProject, TranslationProject, InternshipProject])
export class ProjectLoader extends ObjectViewAwareLoader<Project> {
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
