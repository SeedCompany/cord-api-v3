import { greaterThan, inArray, node, relation } from 'cypher-query-builder';
import {
  ACTIVE,
  filter,
  matchProjectSens,
  path,
  variable,
} from '~/core/database/query';
import { locationFilters } from '../location/location.repository';
import { partnershipFilters } from '../partnership/partnership.repository';
import { ProjectFilters } from './dto';
import { ProjectNameIndex } from './project.repository';

export const projectFilters = filter.define(() => ProjectFilters, {
  type: filter.stringListBaseNodeProp(),
  pinned: filter.isPinned,
  status: filter.stringListProp(),
  step: filter.stringListProp(),
  presetInventory: filter.propVal(),
  createdAt: filter.dateTimeBaseNodeProp(),
  modifiedAt: filter.dateTimeProp(),
  mouStart: filter.dateTimeProp(),
  mouEnd: filter.dateTimeProp(),
  mine: filter.pathExistsWhenTrue([
    node('requestingUser'),
    relation('in', '', 'user'),
    node('', 'ProjectMember'),
    relation('in', '', 'member'),
    node('node'),
  ]),
  languageId: filter.pathExists((id) => [
    node('node'),
    relation('out', '', 'engagement', ACTIVE),
    node('', 'LanguageEngagement'),
    relation('out', '', 'language', ACTIVE),
    node('', 'Language', { id }),
  ]),
  partnerId: filter.pathExists((id) => [
    node('node'),
    relation('out', '', 'partnership', ACTIVE),
    node('', 'Partnership'),
    relation('out', '', 'partner', ACTIVE),
    node('', 'Partner', { id }),
  ]),
  isMember: filter.pathExistsWhenTrue([
    node('requestingUser'),
    relation('in', '', 'user'),
    node('', 'ProjectMember'),
    relation('in', '', 'member'),
    node('node'),
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
  name: filter.fullText({
    index: () => ProjectNameIndex,
    matchToNode: (q) =>
      q.match([
        node('node', 'Project'),
        relation('out', '', 'name', ACTIVE),
        node('match'),
      ]),
    minScore: 0.8,
  }),
  primaryLocation: filter.sub(() => locationFilters)((sub) =>
    sub.match([
      node('outer'),
      relation('out', '', 'primaryLocation', ACTIVE),
      node('node', 'Location'),
    ]),
  ),
  sensitivity:
    ({ value, query }) =>
    () =>
      value
        ? query
            .apply(matchProjectSens('node'))
            .with('*')
            .where({ sensitivity: inArray(value) })
        : query,
  primaryPartnership: filter.sub(() => partnershipFilters)((sub) =>
    sub.match([
      node('outer'),
      relation('out', '', 'partnership', ACTIVE),
      node('node', 'Partnership'),
      relation('out', '', 'primary', ACTIVE),
      node('', 'Property', { value: variable('true') }),
    ]),
  ),
  partnerships: filter.sub(() => partnershipFilters)((sub) =>
    sub.match([
      node('outer'),
      relation('out', '', 'partnership', ACTIVE),
      node('node', 'Partnership'),
    ]),
  ),
});
