import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { ID, PaginatedListType, Session, UnsecuredDto } from '../../common';
import {
  getFromCordTables,
  transformToDto,
  transformToPayload,
} from '../../common/cordtables';
import { DtoRepository } from '../../core';
import { ACTIVE, any, collect, exp, variable } from '../../core/database/query';
import { ProjectStatus } from '../project';
import {
  CreateLanguage,
  Language,
  LanguageListInput,
  TablesLanguages,
  TablesReadLanguage,
  UpdateLanguage,
} from './dto';

@Injectable()
export class LanguageRepository extends DtoRepository(Language) {
  async create(language: CreateLanguage, session: Session, ethnologueId: ID) {
    const response = await getFromCordTables('sc/languages/create-read', {
      language: {
        ...transformToPayload(language, Language.TablesToDto, {
          ethnologue: ethnologueId,
        }),
      },
    });
    const iLanguage: TablesReadLanguage = JSON.parse(response.body);

    const dto: UnsecuredDto<Language> = transformToDto(
      iLanguage.language,
      Language.TablesToDto,
      { pinned: false }
    );
    return dto;
  }

  async readOne(langId: ID): Promise<UnsecuredDto<Language>> {
    const response = await getFromCordTables('sc/languages/read', {
      id: langId,
    });
    const language = response.body;
    const iLanguage: TablesReadLanguage = JSON.parse(language);

    const dto: UnsecuredDto<Language> = transformToDto(
      iLanguage.language,
      Language.TablesToDto,
      { pinned: false }
    );
    return dto;
  }

  async update(
    langToUpdate: Language,
    updates: Partial<Omit<UpdateLanguage, 'id'>>
  ): Promise<void> {
    const updatePayload = transformToPayload(updates, Language.TablesToDto);
    Object.entries(updatePayload).forEach(([key, value]) => {
      void getFromCordTables('sc/languages/update', {
        id: langToUpdate.id,
        column: key,
        value: value,
      });
    });
    return;
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
        return transformToDto(lang, Language.TablesToDto, { pinned: false }); // todo: hacking pinned for now.
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
