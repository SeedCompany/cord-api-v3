import { oneLine } from 'common-tags';
import { node, Query, relation } from 'cypher-query-builder';
import { ID, isIdLike, Session } from '../../../common';
import { matchProps, MatchPropsOptions } from './matching';

export const matchPropsAndProjectSensAndScopedRoles =
  (session?: Session | ID, propsOptions?: MatchPropsOptions) =>
  (query: Query) =>
    query.subQuery(['node', 'project'], (sub) =>
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
        .match([
          node('project'),
          relation('out', '', 'sensitivity', { active: true }),
          node('projSens', 'Property'),
        ])
        .optionalMatch([
          node('project'),
          relation('out', '', 'engagement', { active: true }),
          node('', 'LanguageEngagement'),
          relation('out', '', 'language', { active: true }),
          node('', 'Language'),
          relation('out', '', 'sensitivity', { active: true }),
          node('langSens', 'Property'),
        ])
        .return(
          [
            `
              apoc.map.merge(${propsOptions?.outputVar ?? 'props'}, {
                sensitivity: ${determineSensitivity}
              }) as ${propsOptions?.outputVar ?? 'props'}
            `,
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

const rankSens = (variable: string) => oneLine`
  case ${variable}
    when 'High' then 2
    when 'Medium' then 1
    when 'Low' then 0
  end
`;

const determineSensitivity = `
  case langSens
    when null then projSens.value
    else reduce(
      highestSens = "Low",
      sens in collect(langSens.value) |
        case when ${rankSens('sens')} >
                  ${rankSens('highestSens')}
          then sens
          else highestSens
        end
    )
  end
`.trim();
