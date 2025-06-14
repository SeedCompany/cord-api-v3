import { Injectable, type Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { LazyGetter } from 'lazy-get-decorator';
import {
  type ID,
  type PublicOf,
  type SortablePaginationInput,
  type UnsecuredDto,
} from '~/common';
import { grabInstances } from '~/common/instance-maps';
import { type ChangesOf } from '~/core/database/changes';
import {
  e,
  ExclusivityViolationError,
  RepoFor,
  type ScopeOf,
  TransactionRetryInformer,
} from '~/core/gel';
import {
  ProjectConcretes as ConcreteTypes,
  type CreateProject,
  IProject,
  type Project,
  type ProjectListInput,
  type UpdateProject,
} from './dto';
import { type ProjectRepository as Neo4jRepository } from './project.repository';

export const projectRefShape = e.shape(e.Project, () => ({
  id: true,
  type: true,
}));

const hydrate = e.shape(e.Project, (project) => ({
  ...project['*'],
  ...projectRefShape(project),
  // default::TranslationProject -> TranslationProject, etc.
  __typename: project.__type__.name.slice(9, null),

  rootDirectory: true,
  membership: {
    id: true,
    roles: true,
    inactiveAt: true,
  },
  primaryPartnership: e
    .select(project.partnerships, (p) => ({
      filter: e.op(p.primary, '=', true),
    }))
    .assert_single(),
  primaryLocation: true,
  marketingLocation: true,
  marketingRegionOverride: true,
  fieldRegion: true,
  stepChangedAt: e.op(project.latestWorkflowEvent.at, '??', project.createdAt),
  owningOrganization: e.cast(e.uuid, null), // Not implemented going forward
  presetInventory: e.bool(false), // Not implemented going forward
}));

export const ConcreteRepos = {
  MomentumTranslation: class MomentumTranslationProjectRepository extends RepoFor(
    ConcreteTypes.MomentumTranslation,
    { hydrate },
  ) {},

  MultiplicationTranslation: class MultiplicationTranslationProjectRepository extends RepoFor(
    ConcreteTypes.MultiplicationTranslation,
    { hydrate },
  ) {},

  Internship: class InternshipProjectRepository extends RepoFor(
    ConcreteTypes.Internship,
    { hydrate },
  ) {},
} satisfies Record<keyof typeof ConcreteTypes, Type>;

@Injectable()
export class ProjectGelRepository
  extends RepoFor(IProject, { hydrate, omit: ['create', 'update'] })
  implements PublicOf<Neo4jRepository>
{
  constructor(
    private readonly moduleRef: ModuleRef,
    private readonly retryInformer: TransactionRetryInformer,
  ) {
    super();
  }

  @LazyGetter() protected get concretes() {
    return grabInstances(this.moduleRef, ConcreteRepos);
  }

  async create(input: CreateProject) {
    const { type, sensitivity, otherLocationIds, presetInventory, ...props } =
      input;
    return await this.concretes[input.type].create({
      ...props,
      ownSensitivity: sensitivity,
      otherLocations: otherLocationIds,
    });
  }

  async update(
    existing: UnsecuredDto<Project>,
    changes: ChangesOf<Project, UpdateProject>,
  ) {
    try {
      return await this.defaults.update({
        id: existing.id,
        ...changes,
      });
    } catch (e) {
      if (
        e instanceof ExclusivityViolationError &&
        e.objectFQN.endsWith('Project') &&
        e.property === 'departmentId'
      ) {
        this.retryInformer.markForRetry(e);
      }
      throw e;
    }
  }

  async getPrimaryOrganizationName(id: ID) {
    const project = e.cast(e.Project, e.uuid(id));
    const primary = e
      .select(project.partnerships, (p) => ({
        filter: e.op(p.primary, '=', true),
      }))
      .assert_single();
    const query = primary.partner.organization.name;
    return await this.db.run(query);
  }

  protected listFilters(
    project: ScopeOf<typeof e.Project>,
    { filter: input }: ProjectListInput,
  ) {
    if (!input) return [];
    return [
      (input.type?.length ?? 0) > 0 &&
        e.op(
          project.__type__.name,
          'in',
          e.set(...input.type!.map((type) => `default::${type}Project`)),
        ),
      (input.status?.length ?? 0) > 0 &&
        e.op(
          project.status,
          'in',
          e.cast(e.Project.Status, e.set(...input.status!)),
        ),
      (input.step?.length ?? 0) > 0 &&
        e.op(project.step, 'in', e.cast(e.Project.Step, e.set(...input.step!))),
      input.onlyMultipleEngagements && e.op(project.engagementTotal, '>', 1),
      ...(input.createdAt
        ? [
            input.createdAt.after &&
              e.op(project.createdAt, '>', input.createdAt.after),
            input.createdAt.afterInclusive &&
              e.op(project.createdAt, '>=', input.createdAt.afterInclusive),
            input.createdAt.before &&
              e.op(project.createdAt, '<', input.createdAt.before),
            input.createdAt.beforeInclusive &&
              e.op(project.createdAt, '<=', input.createdAt.beforeInclusive),
          ]
        : []),
      ...(input.modifiedAt
        ? [
            input.modifiedAt.after &&
              e.op(project.modifiedAt, '>', input.modifiedAt.after),
            input.modifiedAt.afterInclusive &&
              e.op(project.modifiedAt, '>=', input.modifiedAt.afterInclusive),
            input.modifiedAt.before &&
              e.op(project.modifiedAt, '<', input.modifiedAt.before),
            input.modifiedAt.beforeInclusive &&
              e.op(project.modifiedAt, '<=', input.modifiedAt.beforeInclusive),
          ]
        : []),
      input.membership != null && e.op('exists', project.membership),
      input.membership?.active && e.op(project.membership.active, '?=', true),
      input.pinned != null && e.op(project.pinned, '=', input.pinned),
      input.languageId &&
        e.op(
          e.uuid(input.languageId),
          'in',
          project.is(e.TranslationProject).languages.id,
        ),
      input.partnerId &&
        e.op(e.uuid(input.partnerId), 'in', project.partnerships.partner.id),
      input.userId &&
        e.op(
          e.uuid(input.userId),
          'in',
          e.op(
            project.members.user.id,
            'union',
            e.select(e.InternshipEngagement, (eng) => ({
              filter: e.op(eng, '=', project),
            })).intern.id,
          ),
        ),
      (input.sensitivity?.length ?? 0) > 0 &&
        e.op(
          project.sensitivity,
          'in',
          e.cast(e.Sensitivity, e.set(...input.sensitivity!)),
        ),
    ];
  }

  protected orderBy(
    scope: ScopeOf<typeof e.Project>,
    input: SortablePaginationInput,
  ) {
    if (input.sort === 'type') {
      return {
        expression: scope.__type__,
        direction: input.order,
      };
    }
    return super.orderBy(scope, input);
  }
}
