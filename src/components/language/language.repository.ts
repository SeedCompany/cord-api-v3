import { Injectable } from '@nestjs/common';
import { simpleSwitch } from '@seedcompany/common';
import {
  equals,
  inArray,
  node,
  not,
  Query,
  relation,
} from 'cypher-query-builder';
import {
  DuplicateException,
  ID,
  labelForView,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { DtoRepository, OnIndex, UniquenessError } from '~/core/database';
import {
  ACTIVE,
  any,
  collect,
  createNode,
  createRelationships,
  defineSorters,
  exp,
  filter,
  FullTextIndex,
  matchChangesetAndChangedProps,
  matchProjectScopedRoles,
  matchProjectSens,
  matchProps,
  merge,
  oncePerProject,
  paginate,
  rankSens,
  requestingUser,
  sortWith,
  variable,
} from '~/core/database/query';
import { ProjectStatus } from '../project/dto';
import {
  CreateLanguage,
  EthnologueLanguage,
  EthnologueLanguageFilters,
  Language,
  LanguageFilters,
  LanguageListInput,
  UpdateLanguage,
} from './dto';
import { EthnologueLanguageService } from './ethnologue-language';

@Injectable()
export class LanguageRepository extends DtoRepository<
  typeof Language,
  [session: Session, view?: ObjectView]
>(Language) {
  constructor(
    private readonly ethnologueLanguageService: EthnologueLanguageService,
  ) {
    super();
  }

  async create(input: CreateLanguage, session: Session) {
    const initialProps = {
      name: input.name,
      displayName: input.displayName,
      sensitivity: input.sensitivity,
      isDialect: input.isDialect,
      populationOverride: input.populationOverride,
      registryOfLanguageVarietiesCode: input.registryOfLanguageVarietiesCode,
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
      input?.ethnologue,
      session,
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

      throw new ServerException('Could not create language', e);
    }

    if (!result) {
      throw new ServerException('Failed to create language');
    }

    return await this.readOne(result.id, session);
  }

  async update(
    changes: Omit<UpdateLanguage, 'ethnologue'>,
    session: Session,
    changeset?: ID,
  ) {
    const { id, ...simpleChanges } = changes;

    await this.updateProperties({ id }, simpleChanges, changeset);

    return await this.readOne(changes.id, session);
  }

  async readMany(ids: readonly ID[], session: Session, view?: ObjectView) {
    return await this.db
      .query()
      .matchNode('node', labelForView('Language', view))
      .where({ 'node.id': inArray(ids) })
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
            ethnologue: 'ethProps',
            pinned: 'exists((:User { id: $requestingUser })-[:pinned]->(node))',
            presetInventory: 'presetInventory',
            firstScriptureEngagement: 'firstScriptureEngagement { .id }',
            scope: 'scopedRoles',
            changeset: 'changeset.id',
          }).as('dto'),
        );
  }

  async list(input: LanguageListInput, session: Session) {
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
      // match requesting user once (instead of once per row)
      .match(requestingUser(session))
      .apply(languageFilters(input.filter))
      .apply(
        this.privileges.forUser(session).filterToReadable({
          wrapContext: oncePerProject,
        }),
      )
      .apply(sortWith(languageSorters, input))
      .apply(paginate(input, this.hydrate(session)))
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
  name: filter.fullText({
    index: () => NameIndex,
    matchToNode: (q) =>
      q.match([
        node('node', 'Language'),
        relation('out', '', undefined, ACTIVE),
        node('match'),
      ]),
  }),
  sensitivity: filter.stringListProp(),
  leastOfThese: filter.propVal(),
  isSignLanguage: filter.propVal(),
  isDialect: filter.propVal(),
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
  presetInventory: ({ value, query }) => {
    query.apply(isPresetInventory).with('*');
    const condition = equals('true', true);
    return { presetInventory: value ? condition : not(condition) };
  },
  pinned: filter.isPinned,
  ethnologue: filter.sub(() => ethnologueFilters)((sub) =>
    sub
      .with('node as lang')
      .match([
        node('lang'),
        relation('out', '', 'ethnologue'),
        node('node', 'EthnologueLanguage'),
      ]),
  ),
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
        any(
          'project',
          collect('project'),
          exp.path([
            node('project'),
            relation('out', '', 'presetInventory', ACTIVE),
            node('', 'Property', { value: variable('true') }),
          ]),
        ).as('presetInventory'),
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
});

const ethnologueSorters = defineSorters(EthnologueLanguage, {});

const NameIndex = FullTextIndex({
  indexName: 'LanguageName',
  labels: ['LanguageName', 'LanguageDisplayName'],
  properties: 'value',
  analyzer: 'standard-folding',
});
