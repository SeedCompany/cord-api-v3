import { Injectable, Type } from '@nestjs/common';
import { ModuleRef } from '@nestjs/core';
import { LazyGetter } from 'lazy-get-decorator';
import { difference } from 'lodash';
import { ID, PublicOf } from '~/common';
import { grabInstances } from '~/common/instance-maps';
import { e, RepoFor } from '~/core/edgedb';
import {
  EngagementConcretes as ConcreteTypes,
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  IEngagement,
  EngagementStatus as Status,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';
import { EngagementRepository } from './engagement.repository';

const baseHydrate = e.shape(e.Engagement, (engagement) => ({
  ...engagement['*'],
  __typename: engagement.__type__.name,
  project: {
    id: true,
    status: true,
    type: true,
  },
  parent: e.tuple({
    identity: engagement.project.id,
    labels: e.array_agg(e.set(engagement.project.__type__.name.slice(9, null))),
    properties: e.tuple({
      id: engagement.project.id,
      createdAt: engagement.project.createdAt,
    }),
  }),
  ceremony: true,
  completeDate: true,
}));

const languageExtraHydrate = {
  language: true,
  firstScripture: true,
  lukePartnership: true,
  openToInvestorVisit: true,
  sentPrintingDate: true,
  paratextRegistryId: true,
  pnp: true,
  historicGoal: true,
} as const;

const internshipExtraHydrate = {
  countryOfOrigin: true,
  intern: true,
  mentor: true,
  position: true,
  methodologies: true,
  growthPlan: true,
} as const;

const languageHydrate = e.shape(e.LanguageEngagement, (le) => ({
  ...baseHydrate(le),
  __typename: le.__type__.name,
  ...languageExtraHydrate,
}));

const internshipHydrate = e.shape(e.InternshipEngagement, (ie) => ({
  ...baseHydrate(ie),
  __typename: ie.__type__.name,
  ...internshipExtraHydrate,
}));

const hydrate = e.shape(e.Engagement, (engagement) => ({
  ...baseHydrate(engagement),
  ...e.is(e.LanguageEngagement, languageExtraHydrate),
  ...e.is(e.InternshipEngagement, internshipExtraHydrate),
}));

export const ConcreteRepos = {
  LanguageEngagement: class LanguageEngagementRepository extends RepoFor(
    ConcreteTypes.LanguageEngagement,
    {
      hydrate: languageHydrate,
      omit: ['create'],
    },
  ) {
    async create(input: CreateLanguageEngagement) {
      const project = e.cast(e.TranslationProject, e.uuid(input.projectId));
      return await this.defaults.create({
        ...input,
        projectContext: project.projectContext,
      });
    }
  },

  InternshipEngagement: class InternshipEngagementRepository extends RepoFor(
    ConcreteTypes.InternshipEngagement,
    {
      hydrate: internshipHydrate,
      omit: ['create'],
    },
  ) {
    async create(input: CreateInternshipEngagement) {
      const project = e.cast(e.InternshipProject, e.uuid(input.projectId));
      return await this.defaults.create({
        ...input,
        projectContext: project.projectContext,
      });
    }
  },
} satisfies Record<keyof typeof ConcreteTypes, Type>;

@Injectable()
export class EngagementEdgeDBRepository
  extends RepoFor(IEngagement, {
    hydrate,
    omit: ['create', 'update'],
  })
  implements PublicOf<EngagementRepository>
{
  constructor(private readonly moduleRef: ModuleRef) {
    super();
  }

  @LazyGetter() protected get concretes() {
    return grabInstances(this.moduleRef, ConcreteRepos);
  }

  async createLanguageEngagement(input: CreateLanguageEngagement) {
    return await this.concretes.LanguageEngagement.create(input);
  }

  async createInternshipEngagement(input: CreateInternshipEngagement) {
    return await this.concretes.InternshipEngagement.create(input);
  }

  get getActualLanguageChanges() {
    return this.concretes.LanguageEngagement.getActualChanges;
  }

  get getActualInternshipChanges() {
    return this.concretes.InternshipEngagement.getActualChanges;
  }

  async updateLanguage(input: UpdateLanguageEngagement) {
    return await this.concretes.LanguageEngagement.update(input);
  }

  async updateInternship(input: UpdateInternshipEngagement) {
    return await this.concretes.InternshipEngagement.update(input);
  }

  async listAllByProjectId(projectId: ID) {
    const project = e.cast(e.Project, e.uuid(projectId));
    const query = e.select(e.Engagement, (eng) => ({
      filter: e.op(eng.project, '=', project),
      ...hydrate(eng),
    }));

    return await this.db.run(query);
  }

  async getOngoingEngagementIds(projectId: ID, excludes: Status[] = []) {
    const project = e.cast(e.Project, e.uuid(projectId));

    const ongoingExceptExclusions = e.cast(
      e.Engagement.Status,
      e.set(...difference([...Status.Ongoing], excludes)),
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
