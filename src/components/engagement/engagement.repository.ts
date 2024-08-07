import { Injectable } from '@nestjs/common';
import { cleanJoin, mapValues, simpleSwitch } from '@seedcompany/common';
import {
  hasLabel,
  inArray,
  node,
  Node,
  Query,
  relation,
} from 'cypher-query-builder';
import { difference, pickBy, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { MergeExclusive } from 'type-fest';
import {
  generateId,
  ID,
  labelForView,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  typenameForView,
  UnsecuredDto,
  viewOfChangeset,
} from '~/common';
import { CommonRepository, OnIndex } from '~/core/database';
import { ChangesOf, getChanges } from '~/core/database/changes';
import {
  ACTIVE,
  coalesce,
  createNode,
  createRelationships,
  defineSorters,
  filter,
  FullTextIndex,
  INACTIVE,
  matchChangesetAndChangedProps,
  matchProjectSens,
  matchPropsAndProjectSensAndScopedRoles,
  merge,
  oncePerProject,
  paginate,
  requestingUser,
  SortCol,
  sortWith,
  whereNotDeletedInChangeset,
} from '~/core/database/query';
import { Privileges } from '../authorization';
import { FileId } from '../file/dto';
import {
  languageFilters,
  languageSorters,
} from '../language/language.repository';
import {
  matchCurrentDue,
  progressReportSorters,
} from '../periodic-report/periodic-report.repository';
import { ProjectType } from '../project/dto';
import { projectFilters } from '../project/project-filters.query';
import { projectSorters } from '../project/project.repository';
import { userFilters } from '../user';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  Engagement,
  EngagementFilters,
  EngagementListInput,
  EngagementStatus,
  IEngagement,
  InternshipEngagement,
  LanguageEngagement,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';

export type LanguageOrEngagementId = MergeExclusive<
  { engagementId: ID },
  { languageId: ID }
>;

@Injectable()
export class EngagementRepository extends CommonRepository {
  constructor(private readonly privileges: Privileges) {
    super();
  }

  async readOne(id: ID, session: Session, view?: ObjectView) {
    const query = this.db
      .query()
      .matchNode('node', labelForView('Engagement', view), { id })
      .apply(this.hydrate(session, view));
    const result = await query.first();
    if (!result) {
      throw new NotFoundException('Could not find Engagement');
    }

    return result.dto;
  }

  async readMany(ids: readonly ID[], session: Session, view?: ObjectView) {
    return await this.db
      .query()
      .matchNode('node', labelForView('Engagement', view))
      .where({ 'node.id': inArray(ids) })
      .apply(this.hydrate(session, view))
      .map('dto')
      .run();
  }

  protected hydrate(session: Session, view?: ObjectView) {
    return (query: Query) =>
      query
        .match([
          node('project'),
          // active check not needed here as project will never change
          // the relationships could be inactive if made in a changeset, we don't care either way.
          relation('out', '', 'engagement'),
          node('node'),
        ])
        .apply(matchPropsAndProjectSensAndScopedRoles(session, { view }))
        .apply(matchChangesetAndChangedProps(view?.changeset))
        .optionalMatch([
          node('node'),
          relation('out', '', 'ceremony', ACTIVE),
          node('ceremony'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'language', ACTIVE),
          node('language'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'intern', ACTIVE),
          node('intern'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'countryOfOrigin', ACTIVE),
          node('countryOfOrigin'),
        ])
        .optionalMatch([
          node('node'),
          relation('out', '', 'mentor', ACTIVE),
          node('mentor'),
        ])
        .optionalMatch([
          node('project'),
          relation('out', '', 'mouStart', ACTIVE),
          node('mouStart'),
        ])
        .optionalMatch([
          node('project'),
          relation('out', '', 'mouEnd', ACTIVE),
          node('mouEnd'),
        ])
        .match([
          node('project'),
          relation('out', '', 'status', ACTIVE),
          node('status'),
        ])
        .return<{ dto: UnsecuredDto<Engagement> }>(
          merge('props', 'changedProps', {
            __typename: typenameForView(
              ['LanguageEngagement', 'InternshipEngagement'],
              view,
            ),
            parent: 'project',
            project: {
              id: 'project.id',
              type: 'project.type',
              status: 'status.value',
            },
            language: 'language.id',
            ceremony: 'ceremony.id',
            intern: 'intern.id',
            countryOfOrigin: 'countryOfOrigin.id',
            mentor: 'mentor.id',
            startDate: coalesce(
              'changedProps.startDateOverride',
              'props.startDateOverride',
              'mouStart.value',
            ),
            endDate: coalesce(
              'changedProps.endDateOverride',
              'props.endDateOverride',
              'mouEnd.value',
            ),
            changeset: 'changeset.id',
          }).as('dto'),
        );
  }

  // CREATE ///////////////////////////////////////////////////////////

  async createLanguageEngagement(
    input: CreateLanguageEngagement,
    changeset?: ID,
  ) {
    const pnpId = await generateId<FileId>();

    const {
      projectId,
      languageId,
      methodology: _,
      ...initialProps
    } = {
      ...mapValues.fromList(CreateLanguageEngagement.Props, () => undefined)
        .asRecord,
      ...input,
      status: input.status || EngagementStatus.InDevelopment,
      pnp: pnpId,
      initialEndDate: undefined,
      statusModifiedAt: undefined,
      lastSuspendedAt: undefined,
      lastReactivatedAt: undefined,
      modifiedAt: DateTime.local(),
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(await createNode(LanguageEngagement, { initialProps }))
      .apply(
        createRelationships(LanguageEngagement, {
          in: {
            engagement: ['Project', projectId],
            changeset: ['Changeset', changeset],
          },
          out: { language: ['Language', languageId] },
        }),
      )
      .return<{ id: ID }>('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('Could not create Language Engagement');
    }

    return { id: result.id, pnpId };
  }

  async createInternshipEngagement(
    input: CreateInternshipEngagement,
    changeset?: ID,
  ) {
    const growthPlanId = await generateId<FileId>();

    const {
      projectId,
      internId,
      mentorId,
      countryOfOriginId,
      ...initialProps
    } = {
      ...mapValues.fromList(CreateInternshipEngagement.Props, () => undefined)
        .asRecord,
      ...input,
      methodologies: input.methodologies || [],
      status: input.status || EngagementStatus.InDevelopment,
      growthPlan: growthPlanId,
      initialEndDate: undefined,
      statusModifiedAt: undefined,
      lastSuspendedAt: undefined,
      lastReactivatedAt: undefined,
      modifiedAt: DateTime.local(),
      canDelete: true,
    };

    const query = this.db
      .query()
      .apply(await createNode(InternshipEngagement, { initialProps }))
      .apply(
        createRelationships(InternshipEngagement, {
          in: {
            engagement: ['Project', projectId],
            changeset: ['Changeset', changeset],
          },
          out: {
            intern: ['User', internId],
            mentor: ['User', mentorId],
            countryOfOrigin: ['Location', countryOfOriginId],
          },
        }),
      )
      .return<{ id: ID }>('node.id as id');
    const result = await query.first();
    if (!result) {
      throw new NotFoundException();
    }

    return { id: result.id, growthPlanId };
  }

  // UPDATE ///////////////////////////////////////////////////////////

  getActualLanguageChanges = getChanges(LanguageEngagement);

  async updateLanguage(
    existing: LanguageEngagement | UnsecuredDto<LanguageEngagement>,
    changes: ChangesOf<LanguageEngagement, UpdateLanguageEngagement>,
    changeset?: ID,
  ): Promise<void> {
    const { pnp, ...simpleChanges } = changes;

    await this.db.updateProperties({
      type: LanguageEngagement,
      object: existing,
      changes: simpleChanges,
      changeset,
    });
  }

  getActualInternshipChanges = getChanges(InternshipEngagement);

  async updateInternship(
    existing: InternshipEngagement | UnsecuredDto<InternshipEngagement>,
    changes: ChangesOf<InternshipEngagement, UpdateInternshipEngagement>,
    changeset?: ID,
  ): Promise<void> {
    const {
      mentorId,
      countryOfOriginId,
      growthPlan: _,
      ...simpleChanges
    } = changes;

    if (mentorId !== undefined) {
      await this.updateRelation('mentor', 'User', existing.id, mentorId);
    }

    if (countryOfOriginId !== undefined) {
      await this.updateRelation(
        'countryOfOrigin',
        'Location',
        existing.id,
        countryOfOriginId,
      );
    }

    await this.db.updateProperties({
      type: InternshipEngagement,
      object: existing,
      changes: simpleChanges,
      changeset,
    });
  }

  // LIST ///////////////////////////////////////////////////////////

  async list(input: EngagementListInput, session: Session, changeset?: ID) {
    const result = await this.db
      .query()
      .subQuery((sub) =>
        sub
          .match([
            node('project', 'Project', pickBy({ id: input.filter?.projectId })),
            relation('out', '', 'engagement', ACTIVE),
            node('node', 'Engagement'),
          ])
          .apply(whereNotDeletedInChangeset(changeset))
          .return(['node', 'project'])
          .apply((q) =>
            changeset && input.filter?.projectId
              ? q
                  .union()
                  .match([
                    node('project', 'Project', { id: input.filter.projectId }),
                    relation('out', '', 'engagement', INACTIVE),
                    node('node', 'Engagement'),
                    relation('in', '', 'changeset', ACTIVE),
                    node('changeset', 'Changeset', { id: changeset }),
                  ])
                  .return(['node', 'project'])
              : q,
          ),
      )
      .match(requestingUser(session))
      .apply(engagementFilters(input.filter))
      .apply(
        this.privileges.for(session, IEngagement).filterToReadable({
          wrapContext: oncePerProject,
        }),
      )
      .apply(sortWith(engagementSorters, input))
      .apply(paginate(input, this.hydrate(session, viewOfChangeset(changeset))))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }

  async listAllByProjectId(projectId: ID, session: Session) {
    return await this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'engagement', ACTIVE),
        node('node', 'Engagement'),
      ])
      .apply(this.hydrate(session))
      .map('dto')
      .run();
  }

  async getOngoingEngagementIds(
    projectId: ID,
    excludes: EngagementStatus[] = [],
  ) {
    const rows = await this.db
      .query()
      .match([
        node('project', 'Project', { id: projectId }),
        relation('out', '', 'engagement', ACTIVE),
        node('engagement'),
        relation('out', '', 'status', ACTIVE),
        node('sn', 'Property'),
      ])
      .where({
        sn: {
          value: inArray(difference([...EngagementStatus.Ongoing], excludes)),
        },
      })
      .return<{ id: ID }>('engagement.id as id')
      .run();
    return rows.map((r) => r.id);
  }

  async verifyRelationshipEligibility(
    projectId: ID,
    otherId: ID,
    isTranslation: boolean,
    property: 'language' | 'intern',
    changeset?: ID,
  ) {
    return await this.db
      .query()
      .optionalMatch(node('project', 'Project', { id: projectId }))
      .optionalMatch(
        node('other', isTranslation ? 'Language' : 'User', {
          id: otherId,
        }),
      )
      .optionalMatch([
        node('project'),
        //  we want to check both active and current changeset to validate that a duplicate
        //  won't be created in either view.
        relation('out', '', 'engagement'),
        node('engagement', 'Engagement'),
        relation('out', '', property, ACTIVE),
        node('other'),
      ])
      .optionalMatch(
        changeset
          ? [
              node('engagement'),
              relation('in', '', 'changeset', ACTIVE),
              node('changesetNode', 'Changeset', { id: changeset }),
            ]
          : [node('engagement')],
      )
      .return(['project', 'other', 'engagement'])
      .asResult<{
        project?: Node<{ type: ProjectType }>;
        other?: Node;
        engagement?: Node;
      }>()
      .first();
  }

  async doesLanguageHaveExternalFirstScripture(id: LanguageOrEngagementId) {
    const result = await this.db
      .query()
      .apply(this.matchLanguageOrEngagement(id))
      .match([
        node('language'),
        relation('out', '', 'hasExternalFirstScripture', ACTIVE),
        node('', 'Property', { value: true }),
      ])
      .return('language')
      .first();
    return !!result;
  }

  async doOtherEngagementsHaveFirstScripture(id: LanguageOrEngagementId) {
    const result = await this.db
      .query()
      .apply(this.matchLanguageOrEngagement(id))
      .match([
        node('language'),
        relation('in', '', 'language', ACTIVE),
        node('otherLanguageEngagements', 'LanguageEngagement'),
        relation('out', '', 'firstScripture', ACTIVE),
        node('', 'Property', { value: true }),
      ])
      .return('otherLanguageEngagements')
      .first();
    return !!result;
  }

  private matchLanguageOrEngagement({
    engagementId,
    languageId,
  }: LanguageOrEngagementId) {
    return (query: Query) =>
      engagementId
        ? query.match([
            node('languageEngagement', 'LanguageEngagement', {
              id: engagementId,
            }),
            relation('out', '', 'language', ACTIVE),
            node('language', 'Language'),
          ])
        : query.match([node('language', 'Language', { id: languageId })]);
  }

  @OnIndex()
  private createIndexes() {
    return this.getConstraintsFor(IEngagement);
  }
  @OnIndex('schema')
  private async createSchemaIndexes() {
    await this.db.query().apply(NameIndex.create()).run();
    await this.db.query().apply(EngagedNameIndex.create()).run();
    await this.db.query().apply(LanguageNameIndex.create()).run();
    await this.db.query().apply(InternshipNameIndex.create()).run();
  }
}

export const engagementFilters = filter.define(() => EngagementFilters, {
  type: ({ value }) => ({
    node: hasLabel(
      simpleSwitch(value, {
        language: 'LanguageEngagement',
        internship: 'InternshipEngagement',
      })!,
    ),
  }),
  status: filter.stringListProp(),
  name: filter.fullText({
    index: () => NameIndex,
    matchToNode: (q) =>
      q.match([
        node('node', 'Engagement'),
        relation('either', '', undefined, ACTIVE),
        node('', 'BaseNode'),
        relation('out', '', undefined, ACTIVE),
        node('match'),
      ]),
    // UI joins project & language/intern names with dash
    // Remove it from search if users type it
    normalizeInput: (v) => v.replaceAll(/ -/g, ''),
    // Treat each word as a separate search term
    // Each word could point to a different node
    // i.e. "project - language"
    separateQueryForEachWord: true,
    minScore: 0.9,
  }),
  engagedName: filter.fullText({
    index: () => EngagedNameIndex,
    matchToNode: (q) =>
      q.match([
        node('node', 'Engagement'),
        relation('out', '', undefined, ACTIVE),
        node('', 'BaseNode'),
        relation('out', '', undefined, ACTIVE),
        node('match'),
      ]),
    // Treat each word as a separate search term
    // Each word could point to a different node
    // i.e. "first - last"
    separateQueryForEachWord: true,
    minScore: 0.9,
  }),
  projectId: filter.pathExists((id) => [
    node('node'),
    relation('in', '', 'engagement'),
    node('project', 'Project', { id }),
  ]),
  partnerId: filter.pathExists((id) => [
    node('node'),
    relation('in', '', 'engagement'),
    node('', 'Project'),
    relation('out', '', 'partnership', ACTIVE),
    node('', 'Partnership'),
    relation('out', '', 'partner'),
    node('', 'Partner', { id }),
  ]),
  languageId: filter.pathExists((id) => [
    node('node'),
    relation('out', '', 'language'),
    node('', 'Language', { id }),
  ]),
  project: filter.sub(
    () => projectFilters,
    'requestingUser',
  )((sub) =>
    sub
      .with('node as eng, requestingUser')
      .match([
        node('eng'),
        relation('in', '', 'engagement'),
        node('node', 'Project'),
      ]),
  ),
  language: filter.sub(() => languageFilters)((sub) =>
    sub
      .with('node as eng')
      .match([
        node('eng'),
        relation('out', '', 'language'),
        node('node', 'Language'),
      ]),
  ),
  intern: filter.sub(() => userFilters)((sub) =>
    sub
      .with('node as eng')
      .match([
        node('eng'),
        relation('out', '', 'intern'),
        node('node', 'User'),
      ]),
  ),
  startDate: filter.dateTime(({ query }) => {
    query.optionalMatch([
      [
        node('node'),
        relation('out', '', 'startDateOverride', ACTIVE),
        node('startDateOverride', 'Property'),
      ],
      [
        node('node'),
        relation('in', '', 'engagement'),
        node('project', 'Project'),
        relation('out', '', 'mouStart', ACTIVE),
        node('mouStart', 'Property'),
      ],
    ]);
    return coalesce('startDateOverride.value', 'mouStart.value');
  }),
  endDate: filter.dateTime(({ query }) => {
    query.optionalMatch([
      [
        node('node'),
        relation('out', '', 'endDateOverride', ACTIVE),
        node('endDateOverride', 'Property'),
      ],
      [
        node('node'),
        relation('in', '', 'engagement'),
        node('project', 'Project'),
        relation('out', '', 'mouEnd', ACTIVE),
        node('mouEnd', 'Property'),
      ],
    ]);
    return coalesce('endDateOverride.value', 'mouEnd.value');
  }),
});

export const engagementSorters = defineSorters(IEngagement, {
  nameProjectFirst: (query) =>
    query
      .apply(matchNames)
      .return<SortCol>(
        multiPropsAsSortString(['projectName', 'languageName', 'dfn', 'dln']),
      ),
  nameProjectLast: (query) =>
    query
      .apply(matchNames)
      .return<SortCol>(
        multiPropsAsSortString(['languageName', 'dfn', 'dln', 'projectName']),
      ),
  sensitivity: (query) =>
    query
      .match([node('project'), relation('out', '', 'engagement'), node('node')])
      .apply(matchProjectSens())
      .return<{ sortValue: unknown }>('sensitivity as sortValue'),
  ...mapValues.fromList(
    ['startDate', 'endDate'],
    (field) => (query: Query) =>
      query
        .optionalMatch([
          node('node'),
          relation('out', '', `${field}Override`, ACTIVE),
          node('override', 'Property'),
        ])
        .optionalMatch([
          node('node'),
          relation('in', '', 'engagement'),
          node('project'),
          relation('out', '', `mou${upperFirst(field.slice(0, -4))}`, ACTIVE),
          node('projProp'),
        ])
        .return<{ sortValue: unknown }>(
          coalesce('override.value', 'projProp.value').as('sortValue'),
        ),
  ).asRecord,
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'language.*': (query, input) =>
    query
      .with('node as eng')
      .match([node('eng'), relation('out', '', 'language'), node('node')])
      .apply(sortWith(languageSorters, input))
      // Use null for all internship engagements
      .union()
      .with('node')
      .with('node as eng')
      .raw('where eng:InternshipEngagement')
      .return<SortCol>('null as sortValue'),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'project.*': (query, input) =>
    query
      .with('node as eng')
      .match([node('eng'), relation('in', '', 'engagement'), node('node')])
      .apply(sortWith(projectSorters, input)),
  // eslint-disable-next-line @typescript-eslint/naming-convention
  'currentProgressReportDue.*': (query, input) =>
    query
      .subQuery('node', (sub) =>
        sub
          .with('node as parent')
          .apply(matchCurrentDue(undefined, 'Progress'))
          .return('collect(node) as reports'),
      )
      .subQuery('reports', (sub) =>
        sub
          .with('reports')
          .raw('where size(reports) = 0')
          .return('null as sortValue')
          .union()
          .with('reports')
          .with('reports')
          .raw('where size(reports) <> 0')
          .raw('unwind reports as node')
          .apply(sortWith(progressReportSorters, input)),
      )
      .return('sortValue'),
});

const matchNames = (query: Query) =>
  query
    .match([
      node('project'),
      relation('out', '', 'name', ACTIVE),
      node('projectName', 'Property'),
    ])
    .optionalMatch([
      node('node'),
      relation('out', '', 'language'),
      node('', 'Language'),
      relation('out', '', 'name', ACTIVE),
      node('languageName', 'Property'),
    ])
    .optionalMatch([
      [node('node'), relation('out', '', 'intern'), node('intern', 'User')],
      [
        node('intern'),
        relation('out', '', 'displayFirstName', ACTIVE),
        node('dfn', 'Property'),
      ],
      [
        node('intern'),
        relation('out', '', 'displayLastName', ACTIVE),
        node('dln', 'Property'),
      ],
    ]);

const multiPropsAsSortString = (props: string[]) =>
  cleanJoin(
    ' + ',
    props.map((prop) => `coalesce(${prop}.value, "")`),
  ) + ' as sortValue';

const NameIndex = FullTextIndex({
  indexName: 'EngagementName',
  labels: ['ProjectName', 'LanguageName', 'LanguageDisplayName', 'UserName'],
  properties: 'value',
  analyzer: 'standard-folding',
});
const EngagedNameIndex = FullTextIndex({
  indexName: 'EngagedName',
  labels: ['LanguageName', 'LanguageDisplayName', 'UserName'],
  properties: 'value',
  analyzer: 'standard-folding',
});
const LanguageNameIndex = FullTextIndex({
  indexName: 'LanguageEngagementName',
  labels: ['ProjectName', 'LanguageName', 'LanguageDisplayName'],
  properties: 'value',
  analyzer: 'standard-folding',
});
const InternshipNameIndex = FullTextIndex({
  indexName: 'InternshipEngagementName',
  labels: ['ProjectName', 'UserName'],
  properties: 'value',
  analyzer: 'standard-folding',
});
