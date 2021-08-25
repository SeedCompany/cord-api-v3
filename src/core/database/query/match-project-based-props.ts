import { oneLine } from 'common-tags';
import { node, Query, relation } from 'cypher-query-builder';
import { Variable } from '.';
import { ID, isIdLike, Sensitivity, Session } from '../../../common';
import { ScopedRole } from '../../../components/authorization';
import { ProjectType } from '../../../components/project/dto/type.enum';
import {
  apoc,
  coalesce,
  collect,
  listConcat,
  merge,
  reduce,
} from './cypher-functions';
import { ACTIVE, matchProps, MatchPropsOptions } from './matching';

export const matchPropsAndProjectSensAndScopedRoles =
  (session?: Session | ID | Variable, propsOptions?: MatchPropsOptions) =>
  <R>(query: Query<R>) =>
    query.comment`
      matchPropsAndProjectSensAndScopedRoles()
    `.subQuery((sub) =>
      sub
        .with([
          'node',
          'project',
          ...(session instanceof Variable ? [session.name] : []),
        ])
        .apply(matchProjectSens('project'))
        .apply(
          matchProps(
            propsOptions?.view?.deleted
              ? propsOptions
              : { ...propsOptions, view: { active: true } }
          )
        )
        .apply((q) =>
          !session ? q : q.apply(matchProjectScopedRoles({ session }))
        )
        .return([
          merge(propsOptions?.outputVar ?? 'props', {
            sensitivity: 'sensitivity',
            scope: session ? `scopedRoles` : null,
          }).as(propsOptions?.outputVar ?? 'props'),
        ])
    );

export const matchProjectScopedRoles =
  <Output extends string = 'scopedRoles'>({
    session,
    projectVar = 'project',
    outputVar = 'scopedRoles' as Output,
  }: {
    session: Session | ID | Variable;
    projectVar?: string;
    outputVar?: Output;
  }) =>
  <R>(query: Query<R>) =>
    query.comment`matchProjectScopedRoles()`.subQuery(projectVar, (sub) =>
      sub
        .match([
          [
            node(projectVar),
            relation('out', '', 'member'),
            node('projectMember'),
            relation('out', '', 'user'),
            session instanceof Variable
              ? node(session.name)
              : node('user', 'User', {
                  id: isIdLike(session) ? session : session.userId,
                }),
          ],
          [
            node('projectMember'),
            relation('out', '', 'roles', ACTIVE),
            node('rolesProp', 'Property'),
          ],
        ])
        .return<{ [K in Output]: ScopedRole[] }>(
          reduce(
            'scopedRoles',
            [],
            apoc.coll.flatten(collect('rolesProp.value')),
            'role',
            listConcat('scopedRoles', [`"project:" + role`])
          ).as(outputVar)
        )
        .union()
        .matchNode('project')
        .raw('WHERE project IS NULL')
        .return('[] as scopedRoles')
    );

export const matchProjectSens =
  (projectVar = 'project') =>
  <R>(query: Query<R>) =>
    query.comment`matchProjectSens()`.subQuery((sub) =>
      sub
        .with(projectVar) // import
        .with(projectVar) // needed for where clause
        .raw(
          `WHERE ${projectVar} IS NOT NULL AND ${projectVar}.type = "${ProjectType.Internship}"`
        )
        .match([
          node(projectVar),
          relation('out', '', 'sensitivity', ACTIVE),
          node('projSens', 'Property'),
        ])
        .return('projSens.value as sensitivity')
        .union()
        .with(projectVar) // import
        .with(projectVar) // needed for where clause
        .raw(
          `WHERE ${projectVar} IS NOT NULL AND ${projectVar}.type = "${ProjectType.Translation}"`
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
        .return(coalesce('langSens.value', '"High"').as('sensitivity'))
        // If the cardinality of this subquery is zero, no rows will be returned at all.
        // So, if no projects are matched (optional matching), we still need to have a cardinality > 0 in order to continue
        // https://neo4j.com/developer/kb/conditional-cypher-execution/#_the_subquery_must_return_a_row_for_the_outer_query_to_continue
        .union()
        .with(projectVar)
        .with(projectVar)
        .raw(`WHERE ${projectVar} IS NULL`)
        .return<{ sensitivity: Sensitivity }>('"High" as sensitivity')
    );

export const rankSens = (variable: string) => oneLine`
  case ${variable}
    when 'High' then 2
    when 'Medium' then 1
    when 'Low' then 0
  end
`;
