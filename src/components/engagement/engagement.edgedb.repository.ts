import { Injectable } from '@nestjs/common';
import { difference } from 'lodash';
import { ID, PublicOf, Session } from '~/common';
import { castToEnum, e, RepoFor } from '~/core/edgedb';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  EngagementListInput,
  EngagementStatus,
  IEngagement,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';
import { EngagementRepository } from './engagement.repository';

const hydrate = e.shape(e.Engagement, (engagement) => ({
  ...engagement['*'],
  ceremony: true,
  __typename: castToEnum(engagement.__type__.name.slice(9, null), [
    'LanguageEngagement',
    'InternshipEngagement',
  ]),
  parent: e.tuple({
    identity: engagement.project.id,
    // labels: e.array_agg(
    //   e.set(engagement.project.__type__.name.slice(9, null)),
    // ),
  }),
}));

const languageHydrate = e.shape(e.LanguageEngagement, (engagement) => ({
  ...hydrate,
  project: engagement.project,
  language: engagement.language,
  pnp: engagement.pnp,
}));

const internshipHydrate = e.shape(e.InternshipEngagement, (engagement) => ({
  ...hydrate,
  project: engagement.project,
  intern: engagement.intern,
  mentor: engagement.mentor,
  countryOfOrigin: engagement.countryOfOrigin,
  growthPlan: engagement.growthPlan,
}));

@Injectable()
export class EngagementEdgeDBRepository
  extends RepoFor(IEngagement, { hydrate, omit: ['create', 'update'] })
  implements PublicOf<EngagementRepository>
{
  async createLanguageEngagement(
    input: CreateLanguageEngagement,
    _session: Session,
    _changeset?: ID,
  ) {
    const { projectId, languageId, pnp, ...props } = input;

    const project = e.cast(e.TranslationProject, e.uuid(projectId));
    const language = e.cast(e.Language, e.uuid(languageId));

    const createdLanguageEngagement = e.insert(e.LanguageEngagement, {
      project: project as any,
      language: language,
      projectContext: project.projectContext,
      pnp: undefined, //TODO
      ...props,
    });

    const query = e.select(createdLanguageEngagement, languageHydrate);

    return await this.db.run(query);
  }

  async createInternshipEngagement(
    input: CreateInternshipEngagement,
    _session: Session,
    _changeset?: ID,
  ) {
    const { projectId, internId, mentorId, countryOfOriginId, ...props } =
      input;

    const project = e.cast(e.InternshipProject, e.uuid(projectId));
    const intern = e.cast(e.User, e.uuid(internId));
    const mentor = mentorId ? e.cast(e.User, e.uuid(mentorId)) : e.set();
    const countryOfOrigin = countryOfOriginId
      ? e.cast(e.Location, e.uuid(countryOfOriginId))
      : e.set();

    const createdInternshipEngagement = e.insert(e.InternshipEngagement, {
      project: project as any,
      projectContext: project.projectContext,
      intern: intern,
      mentor: mentor,
      countryOfOrigin: countryOfOrigin,
      growthPlan: undefined as any, //TODO
      ...props,
    });

    const query = e.select(createdInternshipEngagement, internshipHydrate);

    return await this.db.run(query);
  }

  getActualLanguageChanges = this.getActualChanges(LanguageEngagement);

  async updateLanguage(
    changes: UpdateLanguageEngagement,
    _session: Session,
    _changeset?: ID,
  ) {
    const { id, pnp, ...simpleChanges } = changes;

    const languageEngagement = e.cast(e.LanguageEngagement, e.uuid(id));

    if (pnp) {
      //TODO
    }

    const updated = e.update(languageEngagement, () => ({
      set: {
        ...simpleChanges,
      },
    }));

    const query = e.select(updated, languageHydrate);

    return await this.db.run(query);
  }

  getActualInternshipChanges = this.getActualChanges(InternshipEngagement);

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

  async list(input: EngagementListInput, _session: Session, _changeset?: ID) {
    return await this.defaults.list(input);
  }

  async listAllByProjectId(projectId: ID, _session: Session) {
    const project = e.cast(e.Project, e.uuid(projectId));
    const query = e.select(project, hydrate);

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

    const query = e.select(project.engagements, (eng) => ({
      filter: e.op(eng.status, 'in', ongoingExceptExclusions),
    }));

    return await this.db.run(query);
  }
}
