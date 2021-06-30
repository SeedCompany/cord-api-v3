import { node, relation } from 'cypher-query-builder';
import { ID, ServerException } from '../../../common';
import {
  DatabaseService,
  EventsHandler,
  IEventHandler,
  ILogger,
  Logger,
} from '../../../core';
import { deleteBaseNode, matchProps } from '../../../core/database/query';
import {
  EngagementService,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from '../../engagement';
import { Engagement } from '../../engagement/dto';
import { ProjectChangeRequestApprovedEvent } from '../../project-change-request/events';

type SubscribedEvent = ProjectChangeRequestApprovedEvent;

@EventsHandler(ProjectChangeRequestApprovedEvent)
export class ApplyApprovedChangesetToEngagement
  implements IEventHandler<SubscribedEvent>
{
  constructor(
    private readonly db: DatabaseService,
    private readonly service: EngagementService,
    @Logger('engagement:change-request:approved')
    private readonly logger: ILogger
  ) {}

  async handle(event: SubscribedEvent) {
    this.logger.debug('Applying changeset props');

    const changeset = event.changeRequest.id;

    try {
      // Update project engagement pending changes
      const engagements = await this.db
        .query()
        .match([
          node('project', 'Project'),
          relation('out', '', 'changeset', { active: true }),
          node('changeset', 'Changeset', { id: changeset }),
        ])
        .subQuery((sub) =>
          sub
            .with('project')
            .match([
              node('project'),
              relation('out', 'engagementRel', 'engagement', {
                active: true,
              }),
              node('node', 'Engagement'),
            ])
            .return('node')
            .union()
            .with('project, changeset')
            .match([
              node('project'),
              relation('out', 'engagementRel', 'engagement', {
                active: false,
              }),
              node('node', 'Engagement'),
              relation('in', 'changesetRel', 'changeset', { active: true }),
              node('changeset'),
            ])
            .setValues({
              'engagementRel.active': true,
              'changesetRel.active': false, // TODO Why is this done?
            })
            .return('node')
        )
        .apply(
          matchProps({
            changeset: changeset,
            optional: true,
            excludeBaseProps: true,
          })
        )
        .return<{
          id: ID;
          type: Engagement['__typename'];
          changes: UpdateLanguageEngagement & UpdateInternshipEngagement;
        }>([
          'node.id as id',
          `[l in labels(node) where l in ['LanguageEngagement', 'InternshipEngagement']][0] as type`,
          'props as changes',
        ])
        .run();

      await Promise.all(
        engagements.map(async ({ id, type, changes }) => {
          const update =
            type === 'LanguageEngagement'
              ? this.service.updateLanguageEngagement.bind(this.service)
              : this.service.updateInternshipEngagement.bind(this.service);
          await update({ ...changes, id }, event.session);
        })
      );

      // Remove deleting engagements
      await this.removeDeletingEngagements(changeset);
    } catch (exception) {
      throw new ServerException(
        'Failed to apply changeset to project',
        exception
      );
    }
  }

  async removeDeletingEngagements(changeset: ID) {
    await this.db
      .query()
      .match([
        node('project', 'Project'),
        relation('out', '', 'changeset', { active: true }),
        node('changeset', 'Changeset', { id: changeset }),
      ])
      .match([
        node('project'),
        relation('out', '', 'engagement', { active: true }),
        node('node', 'Engagement'),
        relation('in', '', 'changeset', { active: true, deleting: true }),
        node('changeset'),
      ])
      .apply(deleteBaseNode('node'))
      .return<{ count: number }>('count(node) as count')
      .run();
  }
}
