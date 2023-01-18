import { node, relation } from 'cypher-query-builder';
import { oncePerProject } from '~/core/database/query';
import { QueryFragment } from '~/core/database/query-augmentation/apply';

/**
 * Fetch project node from a ProgressReport child.
 * Used in {@link import('../../authorization').UserResourcePrivileges.filterToReadable.wrapContext}
 */
export const oncePerProjectFromProgressReportChild =
  (inner: QueryFragment): QueryFragment =>
  (query) =>
    query
      .match([
        node('project', 'Project'),
        relation('out', '', 'engagement'),
        node('', 'Engagement'),
        relation('out', '', 'report'),
        node('', 'ProgressReport'),
        relation('out', '', 'child'),
        node('node'),
      ])
      .apply(oncePerProject(inner));
