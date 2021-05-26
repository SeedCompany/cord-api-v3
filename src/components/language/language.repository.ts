import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { generateId, ID, Session } from '../../common';
import { createBaseNode, DtoRepository, matchRequestingUser } from '../../core';
import {
  calculateTotalAndPaginateList,
  collect,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { CreateLanguage, Language, LanguageListInput } from './dto';
import { languageListFilter } from './query.helpers';

@Injectable()
export class LanguageRepository extends DtoRepository(Language) {
  async create(input: CreateLanguage, session: Session) {
    const secureProps = [
      {
        key: 'name',
        value: input.name,
        isPublic: true,
        isOrgPublic: false,
        label: 'LanguageName',
      },
      {
        key: 'displayName',
        value: input.displayName,
        isPublic: false,
        isOrgPublic: false,
        label: 'LanguageDisplayName',
      },
      {
        key: 'sensitivity',
        value: input.sensitivity,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'isDialect',
        value: input.isDialect,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'populationOverride',
        value: input.populationOverride,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'registryOfDialectsCode',
        value: input.registryOfDialectsCode,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'leastOfThese',
        value: input.leastOfThese,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'leastOfTheseReason',
        value: input.leastOfTheseReason,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'displayNamePronunciation',
        value: input.displayNamePronunciation,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'isSignLanguage',
        value: input.isSignLanguage,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'signLanguageCode',
        value: input.signLanguageCode,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'sponsorEstimatedEndDate',
        value: input.sponsorEstimatedEndDate,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'hasExternalFirstScripture',
        value: input.hasExternalFirstScripture,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'tags',
        value: input.tags,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    const createLanguage = this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(createBaseNode(await generateId(), 'Language', secureProps))
      .return('node.id as id');

    return await createLanguage.first();
  }

  async connect(resultLangId: ID, ethnologueId: string, createdAt: DateTime) {
    await this.db
      .query()
      .matchNode('language', 'Language', {
        id: resultLangId,
      })
      .matchNode('ethnologueLanguage', 'EthnologueLanguage', {
        id: ethnologueId,
      })
      .create([
        node('language'),
        relation('out', '', 'ethnologue', {
          active: true,
          createdAt,
        }),
        node('ethnologueLanguage'),
      ])
      .run();
  }

  async readOne(langId: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'Language', { id: langId })])
      .apply(matchPropList)
      .match([
        node('node'),
        relation('out', '', 'ethnologue'),
        node('eth', 'EthnologueLanguage'),
      ])
      .return('propList, node, eth.id as ethnologueLanguageId')
      .asResult<
        StandardReadResult<DbPropsOfDto<Language>> & {
          ethnologueLanguageId: ID;
        }
      >();
    return await query.first();
  }

  list({ filter, ...input }: LanguageListInput, session: Session) {
    const languageSortMap: Partial<Record<typeof input.sort, string>> = {
      name: 'toLower(prop.value)',
      sensitivity: 'sensitivityValue',
    };
    const sortBy = languageSortMap[input.sort] ?? 'prop.value';

    const sensitivityCase = `case prop.value
        when 'High' then 3
        when 'Medium' then 2
        when 'Low' then 1
      end as sensitivityValue`;
    return this.db
      .query()
      .match([requestingUser(session), ...permissionsOfNode('Language')])
      .apply(languageListFilter(filter))
      .apply(
        calculateTotalAndPaginateList(Language, input, (q) =>
          ['id', 'createdAt'].includes(input.sort)
            ? q.with('*').orderBy(`node.${input.sort}`, input.order)
            : q
                .match([
                  node('node'),
                  relation('out', '', input.sort, { active: true }),
                  node('prop', 'Property'),
                ])
                .with([
                  '*',
                  ...(input.sort === 'sensitivity' ? [sensitivityCase] : []),
                ])
                .orderBy(sortBy, input.order)
        )
      );
  }

  async listProjects(language: Language) {
    const queryProject = this.db
      .query()
      .match([node('language', 'Language', { id: language.id })])
      .match([
        node('language'),
        relation('in', '', 'language', { active: true }),
        node('', 'LanguageEngagement'),
        relation('in', '', 'engagement', { active: true }),
        node('project', 'Project'),
      ])
      .return({ project: [{ id: 'id', createdAt: 'createdAt' }] });

    return await queryProject.run();
  }

  async sponsorStartDate(language: Language) {
    return await this.db
      .query()
      .match([
        node('', 'Language', { id: language.id }),
        relation('in', '', 'language', { active: true }),
        node('engagement', 'LanguageEngagement'),
      ])
      .return(collect('engagement.id', 'engagementIds'))
      .asResult<{ engagementIds: ID[] }>()
      .first();
  }

  async verifyExternalFirstScripture(id: ID) {
    return await this.db
      .query()
      .match([
        node('language', 'Language', { id }),
        relation('in', '', 'language', { active: true }),
        node('languageEngagement', 'LanguageEngagement'),
        relation('out', '', 'firstScripture', { active: true }),
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
}
