import { greaterThan, inArray, node, relation } from 'cypher-query-builder';
import {
  ACTIVE,
  filter,
  matchProjectSens,
  path,
} from '../../core/database/query';
import { ProjectListInput } from './dto';

export const projectListFilter = (input: ProjectListInput) =>
  filter.builder(input.filter, {
    type: filter.skip, // already applied
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
