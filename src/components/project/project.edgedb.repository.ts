import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import {
  CreateProject,
  InternshipProject,
  IProject,
  TranslationProject,
} from './dto';
import { ProjectRepository } from './project.repository';

const hydrate = e.shape(e.Project, (project) => ({
  ...project['*'],
  // default::TranslationProject -> Translation
  // default::InternshipProject -> Internship
  type: project.__type__.name.slice(9, -7) as unknown as
    | 'Translation'
    | 'Internship',
  __typename: project.__type__.name,

  primaryLocation: true,
  marketingLocation: true,
  marketingRegionOverride: true,
  fieldRegion: true,
  owningOrganization: true,
  rootDirectory: true,
}));

@Injectable()
export class TranslationProjectEdgeDBRepository extends RepoFor(
  TranslationProject,
  {
    hydrate,
  },
).withDefaults() {}

@Injectable()
export class InternshipProjectEdgeDBRepository extends RepoFor(
  InternshipProject,
  {
    hydrate,
  },
).withDefaults() {}

@Injectable()
export class ProjectEdgeDBRepository
  extends RepoFor(IProject, {
    hydrate,
  }).customize((cls) => {
    return class extends cls {
      static omit = [];

      constructor(
        readonly translation: TranslationProjectEdgeDBRepository,
        readonly internship: InternshipProjectEdgeDBRepository,
      ) {
        super();
      }

      create(input: CreateProject) {
        return input.type === 'Translation'
          ? this.translation.create(input)
          : this.internship.create(input);
      }
    };
  })
  implements PublicOf<ProjectRepository> {}
