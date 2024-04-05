import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { e, RepoFor, ScopeOf } from '~/core/edgedb';
import {
  CreateProject,
  InternshipProject,
  IProject,
  ProjectListInput,
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

export class TranslationProjectEdgeDBRepository extends RepoFor(
  TranslationProject,
  {
    hydrate,
  },
).withDefaults() {}

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
  }).withDefaults({
    omit: ['create'],
  })
  implements PublicOf<ProjectRepository>
{
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

  protected listFilters(
    project: ScopeOf<typeof e.Project>,
    input: ProjectListInput,
  ) {
    return [
      input.filter.type != null &&
        e.op(
          project.__type__.name,
          '=',
          `default::${input.filter.type}Project`,
        ),
      // More filters here when needed...
    ];
  }
}
