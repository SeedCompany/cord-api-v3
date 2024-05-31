import { Injectable } from '@nestjs/common';
import { difference } from 'lodash';
import { ID, PublicOf, Session } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import {
  CreateLanguageEngagement,
  EngagementListInput,
  EngagementStatus,
  LanguageEngagement,
  UpdateLanguageEngagement,
} from './dto';
import { EngagementRepository } from './engagement.repository';

@Injectable()
export class EngagementEdgeDBRepository
  extends RepoFor(LanguageEngagement, {
    hydrate: (engagement) => ({
      ...engagement['*'],
      project: true,
      language: true,
      ceremony: true,
      pnp: true,
      parent: e.tuple({
        identity: engagement.project.id,
        // labels: e.array_agg(
        //   e.set(engagement.project.__type__.name.slice(9, null)),
        // ),
      }),
      completeDate: engagement.completedDate,
    }),
    omit: ['create', 'update'],
  })
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

    const query = e.select(createdLanguageEngagement, this.hydrate);

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

    const query = e.select(e.LanguageEngagement, () => ({
      filter_single: { project },
    }));

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

    const query = e.select(e.LanguageEngagement, (eng) => ({
      filter: e.op(
        e.op('exists', project),
        'and',
        e.op(eng.status, 'in', ongoingExceptExclusions),
      ),
    }));

    return await this.db.run(query);
  }
}
