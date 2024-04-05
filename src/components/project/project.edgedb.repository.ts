import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { PublicOf } from '~/common';
import { grabInstances, InstanceMapOf } from '~/common/instance-maps';
import { e, RepoFor } from '~/core/edgedb';
import {
  ProjectConcretes as ConcreteTypes,
  CreateProject,
  IProject,
} from './dto';
import { ProjectRepository as Neo4jRepository } from './project.repository';

const hydrate = e.shape(e.Project, (project) => ({
  ...project['*'],
  // default::TranslationProject -> Translation
  // default::InternshipProject -> Internship
  type: project.__type__.name.slice(9, -7) as unknown as
    | 'Translation'
    | 'Internship',
  __typename: project.__type__.name,

  rootDirectory: true,
  primaryLocation: true,
  marketingLocation: true,
  marketingRegionOverride: true,
  fieldRegion: true,
  owningOrganization: e.cast(e.uuid, null), // Not implemented going forward
}));

export const ConcreteRepos = {
  Translation: class TranslationProjectRepository extends RepoFor(
    ConcreteTypes.Translation,
    { hydrate },
  ).withDefaults() {},

  Internship: class InternshipProjectRepository extends RepoFor(
    ConcreteTypes.Internship,
    { hydrate },
  ).withDefaults() {},
} satisfies Record<keyof typeof ConcreteTypes, Type>;

@Injectable()
export class ProjectEdgeDBRepository
  extends RepoFor(IProject, { hydrate }).withDefaults()
  implements PublicOf<Neo4jRepository>
{
  protected readonly concretes: InstanceMapOf<typeof ConcreteRepos>;

  constructor(moduleRef: ModuleRef) {
    super();
    this.concretes = grabInstances(moduleRef, ConcreteRepos);
  }

  async create(input: CreateProject) {
    return await this.concretes[input.type].create(input);
  }
}
