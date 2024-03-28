import { Injectable } from '@nestjs/common';
import { e, RepoFor } from '~/core/edgedb';
import {
  CreateProject,
  InternshipProject,
  IProject,
  TranslationProject,
} from './dto';

const hydrate = e.shape(e.Project, (project) => ({
  ...project['*'],
}));

@Injectable()
export class TranslationProjectRepository extends RepoFor(TranslationProject, {
  hydrate,
}).withDefaults() {}

@Injectable()
export class InternshipProjectRepository extends RepoFor(InternshipProject, {
  hydrate,
}).withDefaults() {}

@Injectable()
export class ProjectEdgeDBRepository extends RepoFor(IProject, {
  hydrate,
}).customize((cls) => {
  return class extends cls {
    constructor(
      readonly translation: TranslationProjectRepository,
      readonly internship: InternshipProjectRepository,
    ) {
      super();
    }

    create(input: CreateProject) {
      return input.type === 'Translation'
        ? this.translation.create(input)
        : this.internship.create(input);
    }
  };
}) {}
