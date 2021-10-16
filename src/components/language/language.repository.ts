import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import {
  ID,
  labelForView,
  NotFoundException,
  ObjectView,
  Session,
  UnsecuredDto,
} from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
import {
  ACTIVE,
  any,
  collect,
  createNode,
  createRelationships,
  exp,
  matchChangesetAndChangedProps,
  matchProjectScopedRoles,
  matchProjectSens,
  matchProjectSensToLimitedScopeMap,
  matchProps,
  merge,
  paginate,
  rankSens,
  requestingUser,
  sorting,
  variable,
} from '../../core/database/query';
import { AuthSensitivityMapping } from '../authorization/authorization.service';
import { ProjectStatus } from '../project';
import { CreateLanguage, Language, LanguageListInput } from './dto';
import { languageListFilter } from './query.helpers';

@Injectable()
export class LanguageRepository extends DtoRepository(Language) {
  async create(input: CreateLanguage, ethnologueId: ID, session: Session) {
    const initialProps = {
      name: input.name,
      displayName: input.displayName,
      sensitivity: input.sensitivity,
      isDialect: input.isDialect,
      populationOverride: input.populationOverride,
      registryOfDialectsCode: input.registryOfDialectsCode,
      leastOfThese: input.leastOfThese,
      leastOfTheseReason: input.leastOfTheseReason,
      displayNamePronunciation: input.displayNamePronunciation,
      isSignLanguage: input.isSignLanguage,
      signLanguageCode: input.signLanguageCode,
      sponsorEstimatedEndDate: input.sponsorEstimatedEndDate,
      hasExternalFirstScripture: input.hasExternalFirstScripture,
      tags: input.tags,
      canDelete: true,
    };

    const createLanguage = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(await createNode(Language, { initialProps }))
      .apply(
        createRelationships(Language, 'out', {
          ethnologue: ['EthnologueLanguage', ethnologueId],
        })
      )
      .return<{ id: ID }>('node.id as id');

    return await createLanguage.first();
  }

  async readOne(langId: ID, session: Session, view?: ObjectView) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', labelForView('Language', view), { id: langId })])
      .apply(this.hydrate(session, view));

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find language', 'language.id');
    }
    return result.dto;
  }

  async readMany(ids: readonly ID[], session: Session, view?: ObjectView) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .matchNode('node', 'Language')
      .where({ 'node.id': inArray(ids.slice()) })
      .apply(this.hydrate(session, view))
      .map('dto')
      .run();
  }

  protected hydrate(session: Session, view?: ObjectView) {
    return (query: Query) =>
      query
        .optionalMatch([
          node('project', 'Project'),
          relation('out', '', 'engagement', ACTIVE),
          node('', 'LanguageEngagement'),
          relation('out', '', 'engagement'),
          node('node'),
        ])
        .apply(matchProjectScopedRoles({ session }))
        .with([
          'node',
          'collect(project) as projList',
          'keys(apoc.coll.frequenciesAsMap(apoc.coll.flatten(collect(scopedRoles)))) as scopedRoles',
        ])
        .apply(matchProps())
        .apply(matchChangesetAndChangedProps(view?.changeset))
        // get lowest sensitivity across all projects associated with each language.
        .subQuery((sub) =>
          sub
            .with('projList')
            .raw('UNWIND projList as project')
            .apply(matchProjectSens())
            .with('sensitivity')
            .orderBy(rankSens('sensitivity'), 'ASC')
            .raw('LIMIT 1')
            .return('sensitivity as effectiveSensitivity')
            .union()
            .with('projList, props')
            .with('projList, props')
            .raw('WHERE size(projList) = 0')
            .return(`props.sensitivity as effectiveSensitivity`)
        )
        .match([
          node('node'),
          relation('out', '', 'ethnologue'),
          node('eth', 'EthnologueLanguage'),
        ])
        .apply(matchProps({ nodeName: 'eth', outputVar: 'ethProps' }))
        .apply(this.isPresetInventory())
        .optionalMatch([
          node('node'),
          relation('in', '', 'language', ACTIVE),
          node('firstScriptureEngagement', 'LanguageEngagement'),
          relation('out', '', 'firstScripture', ACTIVE),
          node('', 'Property', { value: variable('true') }),
        ])
        .return<{ dto: UnsecuredDto<Language> }>(
          merge('props', 'changedProps', {
            ethnologue: 'ethProps',
            presetInventory: 'presetInventory',
            firstScriptureEngagement: 'firstScriptureEngagement.id',
            scope: 'scopedRoles',
            changeset: 'changeset.id',
          }).as('dto')
        );
  }

  async list(
    input: LanguageListInput,
    session: Session,
    limitedScope?: AuthSensitivityMapping
  ) {
    const result = await this.db
      .query()
      .match([
        ...(limitedScope
          ? [
              node('project', 'Project'),
              relation('out', '', 'engagement', ACTIVE),
              node('', 'LanguageEngagement'),
              relation('out', '', 'engagement'),
            ]
          : []),
        node('node', 'Language'),
      ])
      // match requesting user once (instead of once per row)
      .match(requestingUser(session))
      .apply(matchProjectSensToLimitedScopeMap(limitedScope))
      .apply(languageListFilter(input.filter, this))
      .apply(sorting(Language, input))
      .apply(paginate(input, this.hydrate(session)))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async listProjects(language: Language) {
    const queryProject = this.db
      .query()
      .match([node('language', 'Language', { id: language.id })])
      .match([
        node('language'),
        relation('in', '', 'language', ACTIVE),
        node('', 'LanguageEngagement'),
        relation('in', '', 'engagement', ACTIVE),
        node('project', 'Project'),
      ])
      .return<{ id: ID }>({ project: [{ id: 'id' }] });

    return await queryProject.run();
  }

  async sponsorStartDate(language: Language) {
    return await this.db
      .query()
      .match([
        node('', 'Language', { id: language.id }),
        relation('in', '', 'language', ACTIVE),
        node('engagement', 'LanguageEngagement'),
      ])
      .return(collect('engagement.id').as('engagementIds'))
      .asResult<{ engagementIds: ID[] }>()
      .first();
  }

  async verifyExternalFirstScripture(id: ID) {
    return await this.db
      .query()
      .match([
        node('language', 'Language', { id }),
        relation('in', '', 'language', ACTIVE),
        node('languageEngagement', 'LanguageEngagement'),
        relation('out', '', 'firstScripture', ACTIVE),
        node('firstScripture', 'Property'),
      ])
      .where({
        firstScripture: {
          value: true,
        },
      })
      .return('languageEngagement')
      .first();
  }

  isPresetInventory() {
    return (query: Query) =>
      query.subQuery('node', (sub) =>
        sub
          .optionalMatch([
            node('node'),
            relation('in', '', 'language', ACTIVE),
            node('', 'LanguageEngagement'),
            relation('in', '', 'engagement', ACTIVE),
            node('project', 'Project'),
            relation('out', '', 'status', ACTIVE),
            node('status', 'ProjectStatus'),
          ])
          .where({
            'status.value': inArray(
              `['${ProjectStatus.InDevelopment}', '${ProjectStatus.Active}']` as any,
              true
            ),
          })
          .return(
            any(
              'project',
              collect('project'),
              exp.path([
                node('project'),
                relation('out', '', 'presetInventory', ACTIVE),
                node('', 'Property', { value: variable('true') }),
              ])
            ).as('presetInventory')
          )
      );
  }
}
