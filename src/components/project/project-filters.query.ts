import { greaterThan, inArray, node, relation } from 'cypher-query-builder';
import { ACTIVE, filter, matchProjectSens, path } from '~/core/database/query';
import { ProjectFilters } from './dto';
import { ProjectNameIndex } from './project.repository';

export const projectFilters = filter.define(() => ProjectFilters, {
  name: filter.fullText({
    index: () => ProjectNameIndex,
    matchToNode: (q) =>
      q.match([
        node('node', 'Project'),
        relation('out', '', 'name', ACTIVE),
        node('match'),
      ]),
  }),
  type: filter.stringListBaseNodeProp(),
  status: filter.stringListProp(),
  onlyMultipleEngagements:
    ({ value, query }) =>
    () =>
      value
        ? query
            .match([
              node('node'),
              relation('out', '', 'engagement', ACTIVE),
              node('engagement', 'Engagement'),
            ])
            .with('node, count(engagement) as engagementCount')
            .where({ engagementCount: greaterThan(1) })
        : null,
  step: filter.stringListProp(),
  createdAt: filter.dateTimeBaseNodeProp(),
  modifiedAt: filter.dateTimeProp(),
  mine: filter.pathExistsWhenTrue([
    node('requestingUser'),
    relation('in', '', 'user'),
    node('', 'ProjectMember'),
    relation('in', '', 'member'),
    node('node'),
  ]),
  pinned: filter.isPinned,
  presetInventory: filter.propVal(),
  partnerId: filter.pathExists((id) => [
    node('node'),
    relation('out', '', 'partnership', ACTIVE),
    node('', 'Partnership'),
    relation('out', '', 'partner', ACTIVE),
    node('', 'Partner', { id }),
  ]),
  userId: ({ value }) => ({
    userId: [
      // TODO We can leak if the project includes this person, if the
      // requesting user does not have access to view the project's members.
      path([
        node('node'),
        relation('out', '', 'member', ACTIVE),
        node('', 'ProjectMember'),
        relation('out', '', 'user', ACTIVE),
        node('', 'User', { id: value }),
      ]),
      // TODO does it make sense to include interns in this filter?
      path([
        node('node'),
        relation('out', '', 'engagement', ACTIVE),
        node('', 'Engagement'),
        relation('out', '', 'intern', ACTIVE),
        node('', 'User', { id: value }),
      ]),
    ],
  }),
  languageId: filter.pathExists((id) => [
    node('node'),
    relation('out', '', 'engagement', ACTIVE),
    node('', 'LanguageEngagement'),
    relation('out', '', 'language', ACTIVE),
    node('', 'Language', { id }),
  ]),
  sensitivity:
    ({ value, query }) =>
    () =>
      value
        ? query
            .apply(matchProjectSens('node'))
            .with('*')
            .where({ sensitivity: inArray(value) })
        : query,
});
