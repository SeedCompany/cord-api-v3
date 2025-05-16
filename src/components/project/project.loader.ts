import { type ID, type ObjectView } from '~/common';
import { LoaderFactory, ObjectViewAwareLoader } from '~/core/data-loader';
import {
  InternshipProject,
  IProject,
  MomentumTranslationProject,
  MultiplicationTranslationProject,
  type Project,
  TranslationProject,
} from './dto';
import { ProjectService } from './project.service';

@LoaderFactory(() => [
  IProject,
  TranslationProject,
  MomentumTranslationProject,
  MultiplicationTranslationProject,
  InternshipProject,
])
export class ProjectLoader extends ObjectViewAwareLoader<Project, IProject> {
  constructor(private readonly projects: ProjectService) {
    super();
  }

  async loadManyByView(
    ids: readonly ID[],
    view: ObjectView,
  ): Promise<readonly Project[]> {
    return await this.projects.readMany(ids, view);
  }
}
