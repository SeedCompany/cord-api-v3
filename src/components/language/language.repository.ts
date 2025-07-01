import { Injectable } from '@nestjs/common';
import { simpleSwitch } from '@seedcompany/common';
import {
  equals,
  inArray,
  node,
  not,
  type Query,
  relation,
} from 'cypher-query-builder';
import {
  CreationFailed,
  DuplicateException,
  type ID,
  labelForView,
  NotFoundException,
  type ObjectView,
  ReadAfterCreationFailed,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { DtoRepository, OnIndex, UniquenessError } from '~/core/database';
import {
  ACTIVE,
  any,
  coalesce,
  collect,
  createNode,
  createRelationships,
  defineSorters,
  filter,
  FullTextIndex,
  matchChangesetAndChangedProps,
  matchProjectScopedRoles,
  matchProjectSens,
  matchProps,
  merge,
  oncePerProject,
  paginate,
  pinned,
  propSorter,
  rankSens,
  sortWith,
  variable,
} from '~/core/database/query';
import { ProjectStatus } from '../project/dto';
import {
  type CreateLanguage,
  EthnologueLanguage,
  EthnologueLanguageFilters,
  Language,
  LanguageFilters,
  type LanguageListInput,
  type UpdateLanguage,
} from './dto';
import { EthnologueLanguageService } from './ethnologue-language';

@Injectable()
export class LanguageRepository extends DtoRepository<
  typeof Language,
  [view?: ObjectView]
>(Language) {
  constructor(
    private readonly ethnologueLanguageService: EthnologueLanguageService,
  ) {
    super();
  }

  async create(input: CreateLanguage) {
    const initialProps = {
      name: input.name,
      displayName: input.displayName,
      sensitivity: input.sensitivity,
      isDialect: input.isDialect,
      populationOverride: input.populationOverride,
      registryOfLanguageVarietiesCode:
        input.registryOfLanguageVarietiesCode ?? input.registryOfDialectsCode,
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

    const ethnologueId = await this.ethnologueLanguageService.create(
      input.ethnologue,
    );

    const createLanguage = this.db
      .query()
      .apply(await createNode(Language, { initialProps }))
      .apply(
        createRelationships(Language, 'out', {
          ethnologue: ['EthnologueLanguage', ethnologueId],
        }),
      )
      .return<{ id: ID }>('node.id as id');

    let result;
    try {
      result = await createLanguage.first();
    } catch (e) {
      if (e instanceof UniquenessError) {
        const prop =
          simpleSwitch(e.label, {
            LanguageName: 'name',
            LanguageDisplayName: 'displayName',
            RegistryOfLanguageAndVariantsCode: `registryOfLanguageAndVariantsCode`,
          }) ?? e.label;
        throw new DuplicateException(
          `language.${prop}`,
          `${prop} with value ${e.value} already exists`,
          e,
        );
      }

      throw new CreationFailed(Language, { cause: e });
    }

    if (!result) {
      throw new CreationFailed(Language);
    }

    return await this.readOne(result.id).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(Language)
        : e;
    });
  }

  async update(changes: Omit<UpdateLanguage, 'ethnologue'>, changeset?: ID) {
    const { id, ...simpleChanges } = changes;

    await this.updateProperties({ id }, simpleChanges, changeset);

    return await this.readOne(changes.id);
  }

  async readMany(ids: readonly ID[], view?: ObjectView) {
    return await this.db
      .query()
      .matchNode('node', labelForView('Language', view))
      .where({ 'node.id': inArray(ids) })
      .apply(this.hydrate(view))
      .map('dto')
      .run();
  }

  async readOneByEth(ethnologueId: ID) {
    const dto = await this.db
      .query()
      .match([
        node('eth', 'EthnologueLanguage', { id: ethnologueId }),
        relation('in', '', 'ethnologue', ACTIVE),
        node('node', 'Language'),
      ])
      .apply(this.hydrate())
      .map('dto')
      .first();
    if (!dto) {
      throw new NotFoundException('No Language exists for this Ethnologue id');
    }
    return dto;
  }

  protected hydrate(view?: ObjectView) {
    return (query: Query) =>
      query
        .optionalMatch([
          node('project', 'Project'),
          relation('out', '', 'engagement', ACTIVE),
          node('', 'LanguageEngagement'),
          relation('out', '', 'engagement'),
          node('node'),
        ])
        .apply(matchProjectScopedRoles())
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
            .return(`props.sensitivity as effectiveSensitivity`),
        )
        .match([
          node('node'),
          relation('out', '', 'ethnologue'),
          node('eth', 'EthnologueLanguage'),
        ])
        .apply(matchProps({ nodeName: 'eth', outputVar: 'ethProps' }))
        .apply(isPresetInventory)
        .optionalMatch([
          node('node'),
          relation('in', '', 'language', ACTIVE),
          node('firstScriptureEngagement', 'LanguageEngagement'),
          relation('out', '', 'firstScripture', ACTIVE),
          node('', 'Property', { value: variable('true') }),
        ])
        .return<{ dto: UnsecuredDto<Language> }>(
          merge('props', 'changedProps', {
            __typename: '"Language"',
            ethnologue: 'ethProps',
            pinned,
            presetInventory: 'presetInventory',
            firstScriptureEngagement: 'firstScriptureEngagement { .id }',
            scope: 'scopedRoles',
            changeset: 'changeset.id',
          }).as('dto'),
        );
  }

  async list(input: LanguageListInput) {
    const result = await this.db
      .query()
      .matchNode('node', 'Language')
      .optionalMatch([
        node('project', 'Project'),
        relation('out', '', 'engagement', ACTIVE),
        node('', 'LanguageEngagement'),
        relation('out', '', 'language'),
        node('node'),
      ])
      .apply(languageFilters(input.filter))
      .apply(
        this.privileges.filterToReadable({
          wrapContext: oncePerProject,
        }),
      )
      .apply(sortWith(languageSorters, input))
      .apply(paginate(input, this.hydrate()))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async getEngagementIdsForLanguage(language: Language) {
    const engagementIds = await this.db
      .query()
      .match([
        node('', 'Language', { id: language.id }),
        relation('in', '', 'language', ACTIVE),
        node('engagement', 'LanguageEngagement'),
      ])
      .return(collect('engagement.id').as('engagementIds'))
      .asResult<{ engagementIds: readonly ID[] }>()
      .map('engagementIds')
      .first();
    if (!engagementIds) {
      throw new ServerException('Error fetching sponsorStartDate');
    }
    return engagementIds;
  }

  async hasFirstScriptureEngagement(id: ID) {
    const res = await this.db
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
    return !!res;
  }

  @OnIndex('schema')
  private async createSchemaIndexes() {
    await this.db.query().apply(NameIndex.create()).run();
  }
}

export const languageFilters = filter.define(() => LanguageFilters, {
  pinned: filter.isPinned,
  sensitivity: filter.stringListProp(),
  leastOfThese: filter.propVal(),
  isSignLanguage: filter.propVal(),
  isDialect: filter.propVal(),
  registryOfDialectsCode: filter.propPartialVal(
    'registryOfLanguageVarietiesCode',
  ),
  registryOfLanguageVarietiesCode: filter.propPartialVal(),
  partnerId: filter.pathExists((id) => [
    node('node'),
    relation('in', '', 'language', ACTIVE),
    node('', 'LanguageEngagement'),
    relation('in', '', 'engagement', ACTIVE),
    node('', 'Project'),
    relation('out', '', 'partnership', ACTIVE),
    node('', 'Partnership'),
    relation('out', '', 'partner', ACTIVE),
    node('', 'Partner', { id }),
  ]),
  name: filter.fullText({
    index: () => NameIndex,
    matchToNode: (q) =>
      q.match([
        node('node', 'Language'),
        relation('out', '', undefined, ACTIVE),
        node('match'),
      ]),
  }),
  ethnologue: filter.sub(() => ethnologueFilters)((sub) =>
    sub.match([
      node('outer'),
      relation('out', '', 'ethnologue'),
      node('node', 'EthnologueLanguage'),
    ]),
  ),
  presetInventory: ({ value, query }) => {
    query.apply(isPresetInventory).with('*');
    const condition = equals('true', true);
    return { presetInventory: value ? condition : not(condition) };
  },
});

const ethnologueFilters = filter.define(() => EthnologueLanguageFilters, {
  code: filter.propPartialVal(),
  provisionalCode: filter.propPartialVal(),
  name: filter.propPartialVal(),
});

const isPresetInventory = (query: Query) =>
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
          `['${ProjectStatus.InDevelopment}', '${ProjectStatus.Active}']`,
          true,
        ),
      })
      .return(
        any('project', collect('project'), [
          node('project'),
          relation('out', '', 'presetInventory', ACTIVE),
          node('', 'Property', { value: variable('true') }),
        ]).as('presetInventory'),
      ),
  );

export const languageSorters = defineSorters(Language, {
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'ethnologue.*': (query, input) =>
    query
      .with('node as lang')
      .match([
        node('lang'),
        relation('out', '', 'ethnologue'),
        node('node', 'EthnologueLanguage'),
      ])
      .apply(sortWith(ethnologueSorters, input)),
  ['registryOfDialectsCode' as any]: propSorter(
    'registryOfLanguageVarietiesCode',
  ),
  population: (query) =>
    query
      .match([
        node('node'),
        relation('out', '', 'populationOverride', ACTIVE),
        node('override'),
      ])
      .match([
        node('node'),
        relation('out', '', 'ethnologue'),
        node('', 'EthnologueLanguage'),
        relation('out', '', 'population', ACTIVE),
        node('canonical'),
      ])
      .return<{ sortValue: unknown }>(
        coalesce('override.value', 'canonical.value').as('sortValue'),
      ),
});

const ethnologueSorters = defineSorters(EthnologueLanguage, {});

const NameIndex = FullTextIndex({
  indexName: 'LanguageName',
  labels: ['LanguageName', 'LanguageDisplayName'],
  properties: 'value',
  analyzer: 'standard-folding',
});
