import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { LazyGetter } from 'lazy-get-decorator';
import { difference } from 'lodash';
import { ID, PublicOf, Session } from '~/common';
import { grabInstances } from '~/common/instance-maps';
import { castToEnum, e, RepoFor } from '~/core/edgedb';
import { ProjectType } from '../project/dto';
import {
  EngagementConcretes as ConcreteTypes,
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  EngagementStatus,
  IEngagement,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';
import { EngagementRepository } from './engagement.repository';

const baseHydrate = e.shape(e.Engagement, (engagement) => ({
  ...engagement['*'],
  __typename: castToEnum(engagement.__type__.name.slice(9, null), [
    'LanguageEngagement',
    'InternshipEngagement',
  ]),
  project: e.select(engagement.project, (project) => ({
    id: true,
    status: true,
    type: castToEnum(project.__type__.name.slice(9, -7), ProjectType),
  })),
  parent: e.tuple({
    identity: engagement.project.id,
    labels: e.array_agg(e.set(engagement.project.__type__.name.slice(9, null))),
    properties: e.tuple({
      id: engagement.project.id,
      createdAt: engagement.project.createdAt,
    }),
  }),
  ceremony: true,
  completeDate: engagement.completedDate, // TODO fix in schema
}));

const languageHydrate = e.shape(e.LanguageEngagement, (le) => ({
  ...le['*'],
  ...baseHydrate(le),
  __typename: castToEnum(le.__type__.name.slice(9, null), [
    'LanguageEngagement',
  ]),
  language: true,
  pnp: true,
}));

const internshipHydrate = e.shape(e.InternshipEngagement, (ie) => ({
  ...ie['*'],
  ...baseHydrate(ie),
  __typename: castToEnum(ie.__type__.name.slice(9, null), [
    'InternshipEngagement',
  ]),
  intern: true,
  mentor: true,
  countryOfOrigin: true,
  growthPlan: true,
}));

const hydrate = e.shape(e.Engagement, (engagement) => ({
  ...languageHydrate(engagement),
  ...internshipHydrate(engagement),
  __typename: castToEnum(engagement.__type__.name.slice(9, null), [
    'LanguageEngagement',
    'InternshipEngagement',
  ]),
}));

export const ConcreteRepos = {
  LanguageEngagement: class LanguageEngagementRepository extends RepoFor(
    ConcreteTypes.LanguageEngagement,
    { hydrate: languageHydrate, omit: ['create', 'update'] },
  ) {
    async create(input: CreateLanguageEngagement) {
      const project = e.cast(e.TranslationProject, e.uuid(input.projectId));
      return await this.defaults.create({
        ...input,
        projectContext: project.projectContext,
      });
    }

    async update({ id, ...changes }: UpdateLanguageEngagement) {
      return await this.defaults.update({ id, ...changes });
    }
  },

  InternshipEngagement: class InternshipEngagementRepository extends RepoFor(
    ConcreteTypes.InternshipEngagement,
    { hydrate: internshipHydrate },
  ) {},
} satisfies Record<keyof typeof ConcreteTypes, Type>;

@Injectable()
export class EngagementEdgeDBRepository
  extends RepoFor(IEngagement, { hydrate, omit: ['create', 'update'] })
  implements PublicOf<EngagementRepository>
{
  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  @LazyGetter() protected get concretes() {
    return grabInstances(this.moduleRef, ConcreteRepos);
  }

  async createLanguageEngagement(
    input: CreateLanguageEngagement,
    _session: Session,
    _changeset?: ID,
  ) {
    return await this.concretes.LanguageEngagement.create(input);
  }

  async createInternshipEngagement(
    input: CreateInternshipEngagement,
    _session: Session,
    _changeset?: ID,
  ) {
    return await this.concretes.InternshipEngagement.create(input);
  }

  get getActualLanguageChanges() {
    return this.concretes.LanguageEngagement.getActualChanges;
  }

  async updateLanguage(input: UpdateLanguageEngagement) {
    return await this.concretes.LanguageEngagement.update(input);
  }

  get getActualInternshipChanges() {
    return this.concretes.InternshipEngagement.getActualChanges;
  }

  async updateInternship(
    changes: UpdateInternshipEngagement,
    _session: Session,
    _changeset?: ID,
  ) {
    const { id, mentorId, countryOfOriginId, growthPlan, ...simpleChanges } =
      changes;

    const internshipEngagement = e.cast(e.InternshipEngagement, e.uuid(id));
    const mentor = mentorId ? e.cast(e.User, e.uuid(mentorId)) : e.set();
    const countryOfOrigin = countryOfOriginId
      ? e.cast(e.Location, e.uuid(countryOfOriginId))
      : e.set();

    if (growthPlan) {
      //TODO
    }

    const updated = e.update(internshipEngagement, () => ({
      set: {
        ...simpleChanges,
        mentor,
        countryOfOrigin,
      },
    }));

    const query = e.select(updated, internshipHydrate);

    return await this.db.run(query);
  }

  async listAllByProjectId(projectId: ID, _session: Session) {
    const project = e.cast(e.Project, e.uuid(projectId));
    const query = e.select(e.Engagement, (eng) => ({
      filter: e.op(eng.project, '=', project),
      ...hydrate(eng),
    }));

    return await this.db.run(query);
  }

  async getOngoingEngagementIds(
    projectId: ID,
    excludes: EngagementStatus[] = [],
  ) {
    const project = e.cast(e.Project, e.uuid(projectId));

    const ongoingExceptExclusions = e.cast(
      e.Engagement.Status,
      e.set(...difference([...EngagementStatus.Ongoing], excludes)),
    );

    const engagements = e.select(e.Engagement, (eng) => ({
      filter: e.op(
        e.op(eng.project, '=', project),
        'and',
        e.op(eng.status, 'in', ongoingExceptExclusions),
      ),
    }));

    return await this.db.run(engagements.id);
  }
}
