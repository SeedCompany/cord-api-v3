import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import {
  ID,
  ObjectView,
  PaginatedListType,
  Session,
  UnsecuredDto,
} from '../../common';
import { getFromCordTables } from '../../common/cordtables';
import { DtoRepository, matchRequestingUser } from '../../core';
import {
  ACTIVE,
  any,
  collect,
  exp,
  matchChangesetAndChangedProps,
  matchProjectScopedRoles,
  matchProjectSens,
  matchProps,
  merge,
  rankSens,
  variable,
} from '../../core/database/query';
import { ProjectStatus } from '../project';
import {
  CreateLanguage,
  Language,
  LanguageListInput,
  TablesLanguages,
  TablesReadLanguage,
  transformLanguageDtoToPayload,
  transformLanguagePayloadToDto,
} from './dto';

@Injectable()
export class LanguageRepository extends DtoRepository(Language) {
  async create(language: CreateLanguage, session: Session, ethnologueId: ID) {
    const response = await getFromCordTables('sc/languages/create-read', {
      language: { ...transformLanguageDtoToPayload(language, ethnologueId) },
    });
    const iLanguage: TablesReadLanguage = JSON.parse(response.body);

    const dto: UnsecuredDto<Language> = transformLanguagePayloadToDto(
      iLanguage.language
    );
    return dto;
  }

  async readOne(langId: ID): Promise<UnsecuredDto<Language>> {
    const response = await getFromCordTables('sc/languages/read', {
      id: langId,
    });
    const language = response.body;
    const iLanguage: TablesReadLanguage = JSON.parse(language);

    const dto: UnsecuredDto<Language> = transformLanguagePayloadToDto(
      iLanguage.language
    );
    return dto;
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
        .raw('', { requestingUserId: session.userId })
        .return<{ dto: UnsecuredDto<Language> }>(
          merge('props', 'changedProps', {
            ethnologue: 'ethProps',
            pinned:
              'exists((:User { id: $requestingUserId })-[:pinned]->(node))',
            presetInventory: 'presetInventory',
            firstScriptureEngagement: 'firstScriptureEngagement.id',
            scope: 'scopedRoles',
            changeset: 'changeset.id',
          }).as('dto')
        );
  }

  async list(input: LanguageListInput) {
    const response = await getFromCordTables('sc/languages/list', {
      sort: input.sort,
      order: input.order,
      page: input.page,
      resultsPerPage: input.count,
      filter: { ...input.filter },
    });
    const languages = response.body;
    const iLanguages: TablesLanguages = JSON.parse(languages);

    const langArray: Array<UnsecuredDto<Language>> = iLanguages.languages.map(
      (lang) => {
        return transformLanguagePayloadToDto(lang);
      }
    );

    const totalLoaded = input.count * (input.page - 1) + langArray.length;
    const langList: PaginatedListType<UnsecuredDto<Language>> = {
      items: langArray,
      total: totalLoaded, // ui is wanting the total loaded, not total for this 'load' that has been loaded.
      hasMore: totalLoaded < iLanguages.size,
    };
    return langList;
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
