import { Injectable } from '@nestjs/common';
import { difference } from 'lodash';
import { ID, PublicOf, Session } from '~/common';
import { castToEnum, e, RepoFor } from '~/core/edgedb';
import {
  CreateLanguageEngagement,
  EngagementListInput,
  EngagementStatus,
  IEngagement,
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

  //getActualLanguageChanges = this.getActualChanges(LanguageEngagement);

  async updateLanguage(
    { id, ...changes }: UpdateLanguageEngagement,
    _session: Session,
    _changeset?: ID,
  ) {
    return await this.defaults.update({ id, ...changes });
  }

  async list(input: EngagementListInput, _session: Session, _changeset?: ID) {
    return await this.defaults.list(input);
  }

  async listAllByProjectId(projectId: ID, _session: Session) {
    const project = e.cast(e.TranslationProject, e.uuid(projectId));
    const query = e.select(project, languageHydrate);

    return await this.db.run(query);
  }

  async getOngoingEngagementIds(
    projectId: ID,
    excludes: EngagementStatus[] = [],
  ) {
    const project = e.cast(e.TranslationProject, e.uuid(projectId));

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
