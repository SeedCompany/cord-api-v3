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
  (
    session?: Session | ID | Variable,
    propsOptions?: MatchPropsOptions,
    skipMatchProps = false
  ) =>
  <R>(query: Query<R>) =>
    query.comment`
      matchPropsAndProjectSensAndScopedRoles()
    `.subQuery([...(skipMatchProps ? [] : ['node']), 'project'], (sub) =>
      sub
        .apply(matchProjectSens('project'))
        .apply((q) => (skipMatchProps ? q : q.apply(
          matchProps(
            propsOptions?.view?.deleted
              ? propsOptions
              : { ...propsOptions, view: { active: true } }
          )
        )))
        .apply((q) =>
          !session ? q : q.apply(matchProjectScopedRoles({ session }))
        )
        .return([
          skipMatchProps
            ? 'sensitivity'
            : merge(propsOptions?.outputVar ?? 'props', {
                sensitivity: 'sensitivity',
              }).as(propsOptions?.outputVar ?? 'props'),
          session ? `scopedRoles` : '[] as scopedRoles',
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
    );

export const matchProjectSens =
  (projectVar = 'project') =>
  <R>(query: Query<R>) =>
    query.comment`matchProjectSens()`.subQuery((sub) =>
      sub
        .with(projectVar) // import
        .with(projectVar) // needed for where clause
        .raw(`WHERE ${projectVar}.type = "${ProjectType.Internship}"`)
        .match([
          node(projectVar),
          relation('out', '', 'sensitivity', ACTIVE),
          node('projSens', 'Property'),
        ])
        .return('projSens.value as sensitivity')
        .union()
        .with(projectVar) // import
        .with(projectVar) // needed for where clause
        .raw(`WHERE ${projectVar}.type = "${ProjectType.Translation}"`)
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
        .return<{ sensitivity: Sensitivity }>(
          coalesce('langSens.value', '"High"').as('sensitivity')
        )
    );

export const rankSens = (variable: string) => oneLine`
  case ${variable}
    when 'High' then 2
    when 'Medium' then 1
    when 'Low' then 0
  end
`;
