import { oneLine } from 'common-tags';
import { node, Query, relation } from 'cypher-query-builder';
import { ID, isIdLike, Session } from '../../../common';
import { ProjectType } from '../../../components/project/dto/type.enum';
import { coalesce, merge } from './cypher-functions';
import { matchProps, MatchPropsOptions } from './matching';

export const matchPropsAndProjectSensAndScopedRoles =
  (session?: Session | ID, propsOptions?: MatchPropsOptions) =>
  (query: Query) =>
    query.comment`
      matchPropsAndProjectSensAndScopedRoles()
    `.subQuery(['node', 'project'], (sub) =>
      sub
        .apply(matchProps(propsOptions))
        .apply((q) =>
          session
            ? q.optionalMatch([
                [
                  node('project'),
                  relation('out', '', 'member'),
                  node('projectMember'),
                  relation('out', '', 'user'),
                  node('user', 'User', {
                    id: isIdLike(session) ? session : session.userId,
                  }),
                ],
                [
                  node('projectMember'),
                  relation('out', '', 'roles', { active: true }),
                  node('rolesProp', 'Property'),
                ],
              ])
            : q
        )
        .apply(matchProjectSens('project'))
        .return(
          [
            merge(propsOptions?.outputVar ?? 'props', {
              sensitivity: 'sensitivity',
            }).as(propsOptions?.outputVar ?? 'props'),
            session
              ? `
                  reduce(
                    scopedRoles = [],
                    role IN apoc.coll.flatten(collect(rolesProp.value)) |
                      scopedRoles + ["project:" + role]
                  ) as scopedRoles
                `
              : '[] as scopedRoles',
          ].join(',\n')
        )
    );

export const matchProjectSens = (projectVar: string) => (query: Query) =>
  query.comment`
      matchProjectSens()
    `.subQuery((sub) =>
    sub
      .with(projectVar) // import
      .with(projectVar) // needed for where clause
      .raw(`WHERE ${projectVar}.type = "${ProjectType.Internship}"`)
      .match([
        node(projectVar),
        relation('out', '', 'sensitivity', { active: true }),
        node('projSens', 'Property'),
      ])
      .return('projSens.value as sensitivity')
      .union()
      .with(projectVar) // import
      .with(projectVar) // needed for where clause
      .raw(`WHERE ${projectVar}.type = "${ProjectType.Translation}"`)
      .optionalMatch([
        node(projectVar),
        relation('out', '', 'engagement', { active: true }),
        node('', 'LanguageEngagement'),
        relation('out', '', 'language', { active: true }),
        node('', 'Language'),
        relation('out', '', 'sensitivity', { active: true }),
        node('langSens', 'Property'),
      ])
      .with('*')
      .orderBy(rankSens('langSens.value'), 'DESC')
      // Prevent single row with project from expanding to more here via multiple engagement matches
      .raw('LIMIT 1')
      .return(coalesce('langSens.value', '"High"').as('sensitivity'))
  );

export const rankSens = (variable: string) => oneLine`
  case ${variable}
    when 'High' then 2
    when 'Medium' then 1
    when 'Low' then 0
  end
`;
