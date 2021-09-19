import { Injectable } from '@nestjs/common';
import { inArray, node, Query, relation } from 'cypher-query-builder';
import { ID, NotFoundException, Session, UnsecuredDto } from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
import {
  ACTIVE,
  any,
  collect,
  createNode,
  createRelationships,
  exp,
  matchProps,
  merge,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
  variable,
} from '../../core/database/query';
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

  async readOne(langId: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Language', { id: langId })])
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find language', 'language.id');
    }
    return result.dto;
  }

  async readMany(ids: readonly ID[], session: Session) {
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .matchNode('node', 'Language')
      .where({ 'node.id': inArray(ids.slice()) })
      .apply(this.hydrate())
      .map('dto')
      .run();
  }

  protected hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .match([
          node('node'),
          relation('out', '', 'ethnologue'),
          node('eth', 'EthnologueLanguage'),
        ])
        .apply(matchProps({ nodeName: 'eth', outputVar: 'ethProps' }))
        .apply(this.isPresetInventory())
        .return<{ dto: UnsecuredDto<Language> }>(
          merge('props', {
            ethnologue: 'ethProps',
            presetInventory: 'presetInventory',
          }).as('dto')
        );
  }

  async list(input: LanguageListInput, session: Session) {
    const result = await this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Language')])
      .apply(languageListFilter(input.filter, this))
      .apply(sorting(Language, input))
      .apply(paginate(input, this.hydrate()))
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
