import { oneLine, stripIndent } from 'common-tags';
import { node, Query, relation } from 'cypher-query-builder';
import { Session } from '../../../common';
import { matchProps } from './matching';

export const matchPropsAndProjectSensAndScopedRoles =
  (session: Session) => (query: Query) =>
    query.subQuery((sub) =>
      sub
        .with(['node', 'project'])
        .apply(matchProps())
        .optionalMatch([
          [
            node('project'),
            relation('out', '', 'member'),
            node('projectMember'),
            relation('out', '', 'user'),
            node('user', 'User', { id: session.userId }),
          ],
          [
            node('projectMember'),
            relation('out', '', 'roles', { active: true }),
            node('rolesProp', 'Property'),
          ],
        ])
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
            stripIndent`
apoc.map.merge(props, {
  sensitivity: ${determineSensitivity}
}) as props
        `,
            stripIndent`
          reduce(
            scopedRoles = [],
            role IN apoc.coll.flatten(collect(rolesProp.value)) |
              scopedRoles + ["project:" + role]
          ) as scopedRoles
        `,
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
