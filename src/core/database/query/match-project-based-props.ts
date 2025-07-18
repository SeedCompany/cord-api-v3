import { oneLine } from 'common-tags';
import { node, type Query, relation } from 'cypher-query-builder';
import { type Role, type Sensitivity } from '~/common';
import { type QueryFragment } from '~/core/database/query';
import { type ScopedRole } from '../../../components/authorization/dto';
import { ProjectType } from '../../../components/project/dto/project-type.enum';
import {
  apoc,
  coalesce,
  collect,
  listConcat,
  merge,
  reduce,
} from './cypher-functions';
import {
  ACTIVE,
  currentUser,
  matchProps,
  type MatchPropsOptions,
} from './matching';

export const matchPropsAndProjectSensAndScopedRoles =
  (propsOptions?: MatchPropsOptions) =>
  <R>(query: Query<R>) =>
    query.comment`
      matchPropsAndProjectSensAndScopedRoles()
    `.subQuery((sub) =>
      sub
        .with(['node', 'project'])
        .apply(matchProjectSens('project'))
        .apply(
          matchProps(
            propsOptions?.view?.deleted
              ? propsOptions
              : { ...propsOptions, view: { active: true } },
          ),
        )
        .apply(matchProjectScopedRoles())
        .return([
          merge(propsOptions?.outputVar ?? 'props', {
            sensitivity: 'sensitivity',
            scope: 'scopedRoles',
          }).as(propsOptions?.outputVar ?? 'props'),
        ]),
    );

export const matchProjectScopedRoles =
  <Output extends string = 'scopedRoles'>({
    projectVar = 'project',
    outputVar = 'scopedRoles' as Output,
  }: {
    projectVar?: string;
    outputVar?: Output;
  } = {}) =>
  <R>(query: Query<R>) =>
    query.comment`matchProjectScopedRoles()`.subQuery([projectVar], (sub) =>
      sub
        .match([
          [
            node(projectVar),
            relation('out', '', 'member', ACTIVE),
            node('projectMember'),
            relation('out', '', 'user'),
            currentUser,
          ],
          [
            node('projectMember'),
            relation('out', '', 'roles', ACTIVE),
            node('rolesProp', 'Property'),
          ],
        ])
        .with(collect('rolesProp.value').as('memberRoleProps'))
        .return<{ [K in Output]: ScopedRole[] }>(
          listConcat(
            'case size(memberRoleProps) > 0 when true then ["member:true"] else [] end',
            reduce(
              'scopedRoles',
              [],
              apoc.coll.flatten('memberRoleProps'),
              'role',
              listConcat('scopedRoles', [`"project:" + role`]),
            ),
          ).as(outputVar),
        )
        .union()
        .with('project')
        .with('project')
        .raw('WHERE project IS NULL')
        .return(`[] as ${outputVar}`),
    );

export const matchProjectSens =
  <const Output extends string = 'sensitivity'>(
    projectVar = 'project',
    output: Output = 'sensitivity' as Output,
  ) =>
  <R>(query: Query<R>) =>
    query.comment`matchProjectSens()`.subQuery((sub) =>
      sub
        .with(projectVar) // import
        .with(projectVar) // needed for where clause
        .raw(
          `WHERE ${projectVar} IS NOT NULL AND ${projectVar}.type = "${ProjectType.Internship}"`,
        )
        .match([
          node(projectVar),
          relation('out', '', 'sensitivity', ACTIVE),
          node('projSens', 'Property'),
        ])
        .return(`projSens.value as ${output}`)
        .union()
        .with(projectVar) // import
        .with(projectVar) // needed for where clause
        .raw(
          `WHERE ${projectVar} IS NOT NULL AND ${projectVar}.type <> "${ProjectType.Internship}"`,
        )
        .optionalMatch([
          node(projectVar),
          relation('out', '', 'engagement', ACTIVE),
          node('', 'LanguageEngagement'),
          relation('out', '', 'language', ACTIVE),
          node('', 'Language'),
          relation('out', '', 'sensitivity', ACTIVE),
          node('langSens', 'Property'),
        ])
        .with('*')
        .orderBy(rankSens('langSens.value'), 'DESC')
        // Prevent single row with project from expanding to more here via multiple engagement matches
        .raw('LIMIT 1')
        .return(coalesce('langSens.value', '"High"').as(output))
        // If the cardinality of this subquery is zero, no rows will be returned at all.
        // So, if no projects are matched (optional matching), we still need to have a cardinality > 0 in order to continue
        // https://neo4j.com/developer/kb/conditional-cypher-execution/#_the_subquery_must_return_a_row_for_the_outer_query_to_continue
        .union()
        .with(projectVar)
        .with(projectVar)
        .raw(`WHERE ${projectVar} IS NULL`)
        // TODO this doesn't work for languages without projects. They should use their own sensitivity not High.
        .return<Record<Output, Sensitivity>>(`"High" as ${output}`),
    );

export const matchUserGloballyScopedRoles =
  <Output extends string = 'scopedRoles'>(
    userVar: string,
    outputVar = 'globalRoles' as Output,
  ) =>
  <R>(query: Query<R>) =>
    query.comment('matchUserGloballyScopedRoles()').subQuery((sub) =>
      sub
        .with(userVar)
        .match([
          node(userVar),
          relation('out', '', 'roles', ACTIVE),
          node('role', 'Property'),
        ])
        .return<{ [K in Output]: readonly Role[] }>(
          apoc.coll.flatten(collect('role.value')).as(outputVar),
        ),
    );

// group by project so inner logic doesn't run multiple times for a single project
export const oncePerProject =
  (logic: QueryFragment): QueryFragment =>
  (query) =>
    query
      .with(['project', 'collect(node) as nodeList'])
      .apply(logic)
      .raw('UNWIND nodeList as node');

export const rankSens = (variable: string) => oneLine`
  case ${variable}
    when 'High' then 3
    when 'Medium' then 2
    when 'Low' then 1
  end
`;
