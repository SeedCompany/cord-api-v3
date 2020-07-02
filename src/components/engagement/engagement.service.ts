import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { first, intersection, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession } from '../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  matchSession,
} from '../../core';
import { CeremonyService } from '../ceremony';
import { CeremonyType } from '../ceremony/dto/type.enum';
import { LanguageService } from '../language';
import { LocationService } from '../location';
import {
  ProductListInput,
  ProductService,
  SecuredProductList,
} from '../product';
import { UserService } from '../user';
import {
  CreateInternshipEngagement,
  CreateLanguageEngagement,
  Engagement,
  EngagementListInput,
  EngagementListOutput,
  EngagementStatus,
  InternshipEngagement,
  LanguageEngagement,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';

@Injectable()
export class EngagementService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ceremonyService: CeremonyService,
    private readonly products: ProductService,
    private readonly userService: UserService,
    private readonly languageService: LanguageService,
    private readonly locationService: LocationService,
    private readonly config: ConfigService,
    @Logger(`engagement.service`) private readonly logger: ILogger
  ) {}
  async readOne(id: string, session: ISession): Promise<Engagement> {
    const qr = `
    MATCH (engagement {id: $id, active: true}) RETURN labels(engagement) as labels
    `;

    const results = await this.db.query().raw(qr, { id }).first();
    const label = first(
      intersection(results?.labels, [
        'LanguageEngagement',
        'InternshipEngagement',
      ])
    );

    if (label === 'LanguageEngagement') {
      return this.readLanguageEngagement(id, session);
    }
    return this.readInternshipEngagement(id, session);
  }

  async readLanguageEngagement(
    id: string,
    session: ISession
  ): Promise<Engagement> {
    this.logger.info('readLangaugeEnagement', { id, userId: session.userId });
    const leQuery = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadEngagements' }))
      .match([
        node('languageEngagement', 'LanguageEngagement', {
          active: true,
          id,
        }),
      ]);
    this.propMatch(leQuery, 'firstScripture', 'languageEngagement');
    this.propMatch(leQuery, 'lukePartnership', 'languageEngagement');
    this.propMatch(leQuery, 'sentPrintingDate', 'languageEngagement');
    this.propMatch(leQuery, 'completeDate', 'languageEngagement');
    this.propMatch(leQuery, 'startDate', 'languageEngagement');
    this.propMatch(leQuery, 'endDate', 'languageEngagement');
    this.propMatch(leQuery, 'disbursementCompleteDate', 'languageEngagement');
    this.propMatch(leQuery, 'communicationsCompleteDate', 'languageEngagement');
    this.propMatch(leQuery, 'initialEndDate', 'languageEngagement');
    this.propMatch(leQuery, 'lastSuspendedAt', 'languageEngagement');
    this.propMatch(leQuery, 'lastReactivatedAt', 'languageEngagement');
    this.propMatch(leQuery, 'statusModifiedAt', 'languageEngagement');
    this.propMatch(leQuery, 'status', 'languageEngagement');
    this.propMatch(leQuery, 'modifiedAt', 'languageEngagement');
    this.propMatch(leQuery, 'paraTextRegistryId', 'languageEngagement');
    leQuery
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('permCeremony', 'Permission', {
          property: 'ceremony',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('languageEngagement'),
        relation('out', '', 'ceremony', { active: true }),
        node('newCeremony', 'Ceremony', { active: true }),
        relation('out', '', 'type', { active: true }),
        node('ceremonyType', 'Property', { active: true }),
      ])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('permLanguage', 'Permission', {
          property: 'language',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('languageEngagement'),
        relation('out', '', 'language', { active: true }),
        node('newLanguage', 'Language', { active: true }),
      ])

      .optionalMatch([
        node('languageEngagement'),
        relation('in', '', 'engagement'),
        node('project', 'Project', { active: true }),
      ])
      .return({
        languageEngagement: [{ id: 'id', createdAt: 'createdAt' }],
        newLanguage: [{ id: 'languageId' }],
        newCeremony: [{ id: 'ceremonyId' }],
        project: ['project'],
        firstScripture: [{ value: 'firstScripture' }],
        lukePartnership: [{ value: 'lukePartnership' }],
        sentPrintingDate: [{ value: 'sentPrintingDate' }],
        status: [{ value: 'status' }],
        completeDate: [{ value: 'completeDate' }],
        disbursementCompleteDate: [{ value: 'disbursementCompleteDate' }],
        communicationsCompleteDate: [{ value: 'communicationsCompleteDate' }],
        startDate: [{ value: 'startDate' }],
        endDate: [{ value: 'endDate' }],
        initialEndDate: [{ value: 'initialEndDate' }],
        lastSuspendedAt: [{ value: 'lastSuspendedAt' }],
        lastReactivatedAt: [{ value: 'lastReactivatedAt' }],
        statusModifiedAt: [{ value: 'statusModifiedAt' }],
        modifiedAt: [{ value: 'modifiedAt' }],
        paraTextRegistryId: [{ value: 'paraTextRegistryId' }],
        permLanguage: [{ read: 'canReadLanguage', edit: 'canEditLanguage' }],
        permCeremony: [{ read: 'canReadCeremony', edit: 'canEditCeremony' }],
        canReadFirstScripture: [
          { read: 'canReadFirstScripture', edit: 'canEditFirstScripture' },
        ],
        canReadLukePartnership: [
          { read: 'canReadLukePartnership', edit: 'canEditLukePartnership' },
        ],
        canReadParaTextRegistryId: [
          {
            read: 'canReadParaTextRegistryId',
            edit: 'canEditParaTextRegistryId',
          },
        ],
        canReadSentPrintingDate: [
          {
            read: 'canReadSentPrintingDate',
            edit: 'canEditSentPrintingDate',
          },
        ],
        canReadStatus: [{ read: 'canReadStatus' }],
        canEditStatus: [{ edit: 'canEditStatus' }],
        canReadCompleteDate: [
          { read: 'canReadCompleteDate', edit: 'canEditCompleteDate' },
        ],
        canReadDisbursementCompleteDate: [
          {
            read: 'canReadDisbursementCompleteDate',
            edit: 'canEditDisbursementCompleteDate',
          },
        ],
        canReadCommunicationsCompleteDate: [
          {
            read: 'canReadCommunicationsCompleteDate',
            edit: 'canEditCommunicationsCompleteDate',
          },
        ],
        canReadStartDate: [
          { read: 'canReadStartDate', edit: 'canEditStartDate' },
        ],
        canReadEndDate: [{ read: 'canReadEndDate', edit: 'canEditEndDate' }],
        canReadInitialEndDate: [
          { read: 'canReadInitialEndDate', edit: 'canEditInitialEndDate' },
        ],
        canReadLastSuspendedAt: [
          { read: 'canReadLastSuspendedAt', edit: 'canEditLastSuspendedAt' },
        ],
        canReadLastReactivatedAt: [
          {
            read: 'canReadLastReactivatedAt',
            edit: 'canEditLastReactivatedAt',
          },
        ],
        canReadStatusModifiedAt: [
          {
            read: 'canReadStatusModifiedAt',
            edit: 'canEditStatusModifiedAt',
          },
        ],
        canReadModifiedAt: [
          { read: 'canReadModifiedAt', edit: 'canEditModifiedAt' },
        ],
      });
    let result;
    try {
      result = await leQuery.first();
    } catch (error) {
      this.logger.error('could not read Language Enagement', error);
    }
    if (!result || !result.id) {
      throw new NotFoundException('could not find language Engagement');
    }

    const ceremony = result.ceremonyId
      ? await this.ceremonyService.readOne(result.ceremonyId, session)
      : undefined;

    const language = result.languageId
      ? await this.languageService.readOne(result.languageId, session)
      : undefined;

    const languageEngagement = {
      language: {
        value: language,
        canRead: !!result.canReadLanguage,
        canEdit: !!result.canEditLanguage,
      },
      firstScripture: {
        value: result.firstScripture,
        canRead: !!result.canReadFirstScripture,
        canEdit: !!result.canEditFirstScripture,
      },
      lukePartnership: {
        value: result.lukePartnership,
        canRead: !!result.canReadLukePartnership,
        canEdit: !!result.canEditLukePartnership,
      },
      sentPrintingDate: {
        value: result.sentPrintingDate,
        canRead: !!result.canReadSentPrintingDate,
        canEdit: !!result.canEditSentPrintingDate,
      },
      paraTextRegistryId: {
        value: result.paraTextRegistryId,
        canRead: !!result.canReadParaTextRegistryId,
        canEdit: !!result.canEditParaTextRegistryId,
      },
    };

    return {
      id,
      createdAt: result.createdAt,
      ...languageEngagement,
      status: result.status,
      modifiedAt: result.modifiedAt,
      ceremony: {
        value: ceremony,
        canRead: !!result.canReadCeremony,
        canEdit: !!result.canEditCeremony,
      },
      completeDate: {
        value: result.completeDate,
        canRead: !!result.canReadCompleteDate,
        canEdit: !!result.canEditCompleteDate,
      },
      disbursementCompleteDate: {
        value: result.disbursementCompleteDate,
        canRead: !!result.CanReadDisbursementCompleteDate,
        canEdit: !!result.CanEditDisbursementCompleteDate,
      },
      communicationsCompleteDate: {
        value: result.communicationsCompleteDate,
        canRead: !!result.canReadCommunicationsCompleteDate,
        canEdit: !!result.canEditCommunicationsCompleteDate,
      },
      startDate: {
        value: result.startDate,
        canRead: !!result.canReadStartDate,
        canEdit: !!result.canEditStartDate,
      },
      endDate: {
        value: result.endDate,
        canRead: !!result.canReadEndDate,
        canEdit: !!result.canEditEndDate,
      },
      initialEndDate: {
        value: result.initialEndDate,
        canRead: !!result.canReadInitialEndDate,
        canEdit: !!result.canEditInitialEndDate,
      },
      lastSuspendedAt: {
        value: result.lastSuspendedAt,
        canRead: !!result.canReadLastSuspendedAt,
        canEdit: !!result.canEditLastSuspendedAt,
      },
      lastReactivatedAt: {
        value: result.lastReactivatedAt,
        canRead: !!result.canReadLastReactivatedAt,
        canEdit: !!result.canEditLastReactivatedAt,
      },
      statusModifiedAt: {
        value: result.statusModifiedAt,
        canRead: !!result.canReadStatusModifiedAt,
        canEdit: !!result.canEditStatusModifiedAt,
      },
    };
  }

  async list(
    { page, count, sort, order, filter }: EngagementListInput,
    session: ISession
  ): Promise<EngagementListOutput> {
    const matchNode =
      filter.type === 'internship'
        ? 'internship:InternshipEngagement'
        : filter.type === 'language'
        ? 'language:LanguageEngagement'
        : 'engagement';

    const tmpNode = matchNode.substring(0, matchNode.indexOf(':'));
    const node = tmpNode ? tmpNode : 'engagement';

    const query = `
      MATCH (${matchNode} {active: true})<-[:engagement {active: true}]-(project)
      RETURN ${node}.id as id
      ORDER BY ${node}.${sort} ${order}
      SKIP $skip LIMIT $count
    `;
    const result = await this.db
      .query()
      .raw(query, {
        skip: (page - 1) * count,
        count,
        type: filter.type,
      })
      .run();

    const items = await Promise.all(
      result.map((row) => this.readOne(row.id, session))
    );

    return {
      items,
      total: items.length,
      hasMore: false,
    };
  }

  async listProducts(
    engagement: LanguageEngagement,
    input: ProductListInput,
    session: ISession
  ): Promise<SecuredProductList> {
    const result = await this.products.list(
      {
        ...input,
        filter: {
          ...input.filter,
          engagementId: engagement.id,
        },
      },
      session
    );

    return {
      ...result,
      canRead: true, // TODO
      canCreate: true, // TODO
    };
  }

  propMatch = (query: Query, property: string, baseNode: string) => {
    const readPerm = 'canRead' + upperFirst(property);
    const editPerm = 'canEdit' + upperFirst(property);
    query.optionalMatch([
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(editPerm, 'Permission', {
          property,
          active: true,
          edit: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node(baseNode),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ]);
    query.optionalMatch([
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(readPerm, 'Permission', {
          property,
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node(baseNode),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ]);
  };

  // helper method for defining properties
  property = (prop: string, value: any, baseNode: string) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local().toISO();
    let propLabel = 'Property';
    if (prop === 'position') {
      propLabel = 'Property:InternPosition';
    } else if (prop === 'methodologies') {
      propLabel = 'Property:ProductMethodology';
    } else if (prop === 'status') {
      propLabel = 'Property:EngagementStatus';
    }
    return [
      [
        node(baseNode),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, propLabel, {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  permission = (property: string, baseNode: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node(baseNode),
      ],
    ];
  };

  async createLanguageEngagement(
    { languageId, projectId, ...input }: CreateLanguageEngagement,
    session: ISession
  ): Promise<LanguageEngagement> {
    this.logger.info('Mutation create language engagement ', {
      input,
      projectId,
      languageId,
      userId: session.userId,
    });

    // Initial LanguageEngagement
    const id = generate();
    const createdAt = DateTime.local();
    const ceremony = await this.ceremonyService.create(
      { type: CeremonyType.Dedication },
      session
    );
    const createLE = this.db
      .query()
      .match(matchSession(session, { withAclEdit: 'canCreateEngagement' }))
      .match([
        [
          node('rootuser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ],
        [node('ceremony', 'Ceremony', { active: true, id: ceremony.id })],
      ]);
    if (projectId) {
      createLE.match([
        node('project', 'Project', { active: true, id: projectId }),
      ]);
    }
    if (languageId) {
      createLE.match([
        node('language', 'Language', { active: true, id: languageId }),
      ]);
    }
    createLE.create([
      [
        node('languageEngagement', 'LanguageEngagement:BaseNode', {
          active: true,
          createdAt,
          id,
          owningOrgId: session.owningOrgId,
        }),
      ],
      ...this.property(
        'completeDate',
        input.completeDate || undefined,
        'languageEngagement'
      ),
      ...this.property(
        'disbursementCompleteDate',
        input.disbursementCompleteDate || undefined,
        'languageEngagement'
      ),
      ...this.property(
        'communicationsCompleteDate',
        input.communicationsCompleteDate || undefined,
        'languageEngagement'
      ),
      ...this.property(
        'startDate',
        input.startDate || undefined,
        'languageEngagement'
      ),
      ...this.property(
        'lukePartnership',
        input.lukePartnership || undefined,
        'languageEngagement'
      ),
      ...this.property(
        'firstScripture',
        input.firstScripture || undefined,
        'languageEngagement'
      ),
      ...this.property(
        'paraTextRegistryId',
        input.paraTextRegistryId || undefined,
        'languageEngagement'
      ),
      ...this.property(
        'status',
        EngagementStatus.InDevelopment,
        'languageEngagement'
      ),
      ...this.property('modifiedAt', createdAt, 'languageEngagement'),
    ]);
    createLE.create([
      node('ceremony'),
      relation('in', 'ceremonyRel', 'ceremony', { active: true, createdAt }),
      node('languageEngagement'),
    ]);
    if (projectId) {
      createLE.create([
        node('project'),
        relation('out', 'engagementRel', 'engagement', {
          active: true,
          createdAt,
        }),
        node('languageEngagement'),
      ]);
    }
    if (languageId) {
      createLE.create([
        node('language'),
        relation('in', 'languageRel', 'language', { active: true, createdAt }),
        node('languageEngagement'),
      ]);
    }
    createLE
      .create([
        [
          node('adminSG', 'SecurityGroup', {
            id: generate(),
            active: true,
            createdAt,
            name: 'languageEngagement admin',
          }),
          relation('out', '', 'member', { active: true, createdAt }),
          node('requestingUser'),
        ],
        [
          node('readerSG', 'SecurityGroup', {
            id: generate(),
            active: true,
            createdAt,
            name: 'languageEngagement users',
          }),
          relation('out', '', 'member', { active: true, createdAt }),
          node('requestingUser'),
        ],
        [
          node('adminSG'),
          relation('out', '', 'member', { active: true, createdAt }),
          node('rootuser'),
        ],
        [
          node('readerSG'),
          relation('out', '', 'member', { active: true, createdAt }),
          node('rootuser'),
        ],
        ...this.permission('firstScripture', 'languageEngagement'),
        ...this.permission('lukePartnership', 'languageEngagement'),
        ...this.permission('completeDate', 'languageEngagement'),
        ...this.permission('disbursementCompleteDate', 'languageEngagement'),
        ...this.permission('communicationsCompleteDate', 'languageEngagement'),
        ...this.permission('startDate', 'languageEngagement'),
        ...this.permission('endDate', 'languageEngagement'),
        ...this.permission('ceremony', 'languageEngagement'),
        ...this.permission('language', 'languageEngagement'),
        ...this.permission('status', 'languageEngagement'),
        ...this.permission('paraTextRegistryId', 'languageEngagement'),
        ...this.permission('modifiedAt', 'languageEngagement'),
      ])
      .return('languageEngagement');
    let le;
    try {
      le = await createLE.first();
    } catch (e) {
      this.logger.error('could not create Language Engagement ', e);
      throw new ServerException('Could not create Langauge Engagement');
    }
    if (!le) {
      if (
        projectId &&
        !(await this.db
          .query()
          .match([node('project', 'Project', { active: true, id: projectId })])
          .return('project.id')
          .first())
      ) {
        throw new BadRequestException('projectId is invalid');
      }
      if (
        languageId &&
        !(await this.db
          .query()
          .match([
            node('language', 'Language', { active: true, id: languageId }),
          ])
          .return('language.id')
          .first())
      ) {
        throw new BadRequestException('languageId is invalid');
      }
      throw new ServerException('Could not create Language Engagement');
    }
    const res = (await this.readLanguageEngagement(
      id,
      session
    )) as LanguageEngagement;
    return res;
  }

  async createInternshipEngagement(
    {
      projectId,
      internId,
      mentorId,
      countryOfOriginId,
      ...input
    }: CreateInternshipEngagement,
    session: ISession
  ): Promise<InternshipEngagement> {
    this.logger.info('Mutation create internship engagement ', {
      input,
      projectId,
      mentorId,
      countryOfOriginId,
      userId: session.userId,
    });
    const id = generate();
    const createdAt = DateTime.local();
    let ceremony;
    try {
      ceremony = await this.ceremonyService.create(
        { type: CeremonyType.Certification },
        session
      );
    } catch (e) {
      throw new Error('could not create ceremony');
    }

    const createIE = this.db
      .query()
      .match(matchSession(session, { withAclEdit: 'canCreateEngagement' }))
      .match([
        [
          node('rootuser', 'User', {
            active: true,
            id: this.config.rootAdmin.id,
          }),
        ],
        [node('ceremony', 'Ceremony', { active: true, id: ceremony.id })],
      ]);
    if (projectId) {
      createIE.match([
        node('project', 'Project', { active: true, id: projectId }),
      ]);
    }
    if (internId) {
      createIE.match([node('intern', 'User', { active: true, id: internId })]);
    }
    if (mentorId) {
      createIE.match([node('mentor', 'User', { active: true, id: mentorId })]);
    }
    if (countryOfOriginId) {
      createIE.match([
        node('countryOfOrigin', 'Country', {
          active: true,
          id: countryOfOriginId,
        }),
      ]);
    }
    createIE.create([
      [
        node('internshipEngagement', 'InternshipEngagement:BaseNode', {
          active: true,
          createdAt,
          id,
          owningOrgId: session.owningOrgId,
        }),
      ],
      ...this.property('modifiedAt', createdAt, 'internshipEngagement'),
      ...this.property(
        'completeDate',
        input.completeDate || undefined,
        'internshipEngagement'
      ),
      ...this.property(
        'disbursementCompleteDate',
        input.disbursementCompleteDate || undefined,
        'internshipEngagement'
      ),
      ...this.property(
        'communicationsCompleteDate',
        input.communicationsCompleteDate || undefined,
        'internshipEngagement'
      ),
      ...this.property(
        'startDate',
        input.startDate || undefined,
        'internshipEngagement'
      ),
      ...this.property(
        'endDate',
        input.endDate || undefined,
        'internshipEngagement'
      ),
      ...this.property(
        'methodologies',
        input.methodologies || undefined,
        'internshipEngagement'
      ),
      ...this.property(
        'position',
        input.position || undefined,
        'internshipEngagement'
      ),
      ...this.property(
        'status',
        EngagementStatus.InDevelopment,
        'internshipEngagement'
      ),
    ]);
    createIE.create([
      node('ceremony'),
      relation('in', 'ceremonyRel', 'ceremony', { active: true, createdAt }),
      node('internshipEngagement'),
    ]);
    if (projectId) {
      createIE.create([
        node('project'),
        relation('out', 'engagementRel', 'engagement', {
          active: true,
          createdAt,
        }),
        node('internshipEngagement'),
      ]);
    }
    if (internId) {
      createIE.create([
        node('intern'),
        relation('in', 'internRel', 'intern', { active: true, createdAt }),
        node('internshipEngagement'),
      ]);
    }
    if (mentorId) {
      createIE.create([
        node('mentor'),
        relation('in', 'mentorRel', 'mentor', { active: true, createdAt }),
        node('internshipEngagement'),
      ]);
    }
    if (countryOfOriginId) {
      createIE.create([
        node('countryOfOrigin'),
        relation('in', 'countryRel', 'countryOfOrigin', {
          active: true,
          createdAt,
        }),
        node('internshipEngagement'),
      ]);
    }
    createIE
      .create([
        [
          node('adminSG', 'SecurityGroup', {
            active: true,
            createdAt,
            name: 'internEngagement admin',
            id: generate(),
          }),
          relation('out', '', 'member', { active: true, createdAt }),
          node('requestingUser'),
        ],
        [
          node('readerSG', 'SecurityGroup', {
            active: true,
            createdAt,
            name: 'internEngagement users',
            id: generate(),
          }),
          relation('out', '', 'member', {
            active: true,
            createdAt,
          }),
          node('requestingUser'),
        ],
        [
          node('adminSG'),
          relation('out', '', 'member', {
            active: true,
            createdAt,
          }),
          node('rootuser'),
        ],
        [
          node('readerSG'),
          relation('out', '', 'member', {
            active: true,
            createdAt,
          }),
          node('rootuser'),
        ],
        ...this.permission('completeDate', 'internshipEngagement'),
        ...this.permission(
          'communicationsCompleteDate',
          'internshipEngagement'
        ),
        ...this.permission('disbursementCompleteDate', 'internshipEngagement'),
        ...this.permission('endDate', 'internshipEngagement'),
        ...this.permission('methodologies', 'internshipEngagement'),
        ...this.permission('position', 'internshipEngagement'),
        ...this.permission('endDate', 'internshipEngagement'),
        ...this.permission('modifiedAt', 'internshipEngagement'),
        ...this.permission('startDate', 'internshipEngagement'),
        ...this.permission('language', 'internshipEngagement'),
        ...this.permission('status', 'internshipEngagement'),
        ...this.permission('countryOfOrigin', 'internshipEngagement'),
        ...this.permission('ceremony', 'internshipEngagement'),
        ...this.permission('intern', 'internshipEngagement'),
        ...this.permission('mentor', 'internshipEngagement'),
      ])
      .return('internshipEngagement');
    let IE;
    try {
      IE = await createIE.first();
    } catch (e) {
      // secondary queries to see what ID is bad
      // check internId

      this.logger.error('could not create Internship Engagement ', e);
      throw new ServerException('Could not create Internship Engagement');
    }
    if (!IE) {
      if (
        internId &&
        !(await this.db
          .query()
          .match([node('intern', 'User', { active: true, id: internId })])
          .return('intern.id')
          .first())
      ) {
        throw new BadRequestException('internId is invalid');
      }
      if (
        mentorId &&
        !(await this.db
          .query()
          .match([node('mentor', 'User', { active: true, id: mentorId })])
          .return('mentor.id')
          .first())
      ) {
        throw new BadRequestException('mentorId is invalid');
      }
      if (
        projectId &&
        !(await this.db
          .query()
          .match([node('project', 'Project', { active: true, id: projectId })])
          .return('project.id')
          .first())
      ) {
        throw new BadRequestException('projectId is invalid');
      }
      if (
        countryOfOriginId &&
        !(await this.db
          .query()
          .match([
            node('country', 'Country', {
              active: true,
              id: countryOfOriginId,
            }),
          ])
          .return('country.id')
          .first())
      ) {
        throw new BadRequestException('countryOfOriginId is invalid');
      }
      throw new ServerException('Could not create Internship Engagement');
    }
    try {
      return (await this.readInternshipEngagement(
        id,
        session
      )) as InternshipEngagement;
    } catch (e) {
      this.logger.error(e);

      throw new ServerException(`Could not create InternshipEngagement`);
    }
  }

  async readInternshipEngagement(
    id: string,
    session: ISession
  ): Promise<Engagement> {
    this.logger.info('readInternshipEnagement', { id, userId: session.userId });
    const ieQuery = this.db
      .query()
      .match(matchSession(session, { withAclRead: 'canReadEngagements' }))
      .match([
        node('internshipEngagement', 'InternshipEngagement', {
          active: true,
          id,
        }),
      ]);

    this.propMatch(ieQuery, 'modifiedAt', 'internshipEngagement');
    this.propMatch(ieQuery, 'status', 'internshipEngagement');
    this.propMatch(ieQuery, 'startDate', 'internshipEngagement');
    ieQuery.optionalMatch([
      node('requestingUser'),
      relation('in', '', 'member', { active: true }),
      node('sg', 'SecurityGroup', { active: true }),
      relation('out', '', 'permission', { active: true }),
      node('permIntern', 'Permission', {
        property: 'intern',
        active: true,
        read: true,
      }),
      relation('out', '', 'baseNode', { active: true }),
      node('internshipEngagement'),
      relation('out', '', 'intern', { active: true }),
      node('intern', 'User', { active: true }),
    ]);
    this.propMatch(ieQuery, 'completeDate', 'internshipEngagement');
    this.propMatch(ieQuery, 'position', 'internshipEngagement');

    this.propMatch(ieQuery, 'endDate', 'internshipEngagement');
    this.propMatch(ieQuery, 'disbursementCompleteDate', 'internshipEngagement');
    this.propMatch(
      ieQuery,
      'communicationsCompleteDate',
      'internshipEngagement'
    );
    this.propMatch(ieQuery, 'initialEndDate', 'internshipEngagement');
    this.propMatch(ieQuery, 'lastSuspendedAt', 'internshipEngagement');
    this.propMatch(ieQuery, 'lastReactivatedAt', 'internshipEngagement');
    this.propMatch(ieQuery, 'statusModifiedAt', 'internshipEngagement');
    this.propMatch(ieQuery, 'methodologies', 'internshipEngagement');

    ieQuery
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('permCeremony', 'Permission', {
          property: 'ceremony',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('internshipEngagement'),
        relation('out', '', 'ceremony', { active: true }),
        node('newCeremony', 'Ceremony', { active: true }),
        relation('out', '', 'type', { active: true }),
        node('ceremonyType', 'Property', { active: true }),
      ])

      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('permCountryOfOrigin', 'Permission', {
          property: 'countryOfOrigin',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('internshipEngagement'),
        relation('out', '', 'countryOfOrigin', { active: true }),
        node('country', 'Country', { active: true }),
      ])

      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node('permMentor', 'Permission', {
          property: 'mentor',
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('internshipEngagement'),
        relation('out', '', 'mentor', { active: true }),
        node('mentor', 'User', { active: true }),
      ])

      .optionalMatch([
        node('internshipEngagement'),
        relation('in', '', 'engagement'),
        node('project', 'Project', { active: true }),
      ])
      .return({
        internshipEngagement: [{ id: 'id', createdAt: 'createdAt' }],
        status: [{ value: 'status' }],
        modifiedAt: [{ value: 'modifiedAt' }],
        position: [{ value: 'position' }],
        intern: [{ id: 'internUserId' }],
        startDate: [{ value: 'startDate' }],

        mentor: [{ id: 'mentorUserId' }],
        country: [{ id: 'countryOfOriginId' }],
        newCeremony: [{ id: 'ceremonyId' }],
        project: [{ id: 'projectId' }],

        completeDate: [{ value: 'completeDate' }],
        disbursementCompleteDate: [{ value: 'disbursementCompleteDate' }],
        communicationsCompleteDate: [{ value: 'communicationsCompleteDate' }],

        endDate: [{ value: 'endDate' }],
        initialEndDate: [{ value: 'initialEndDate' }],
        lastSuspendedAt: [{ value: 'lastSuspendedAt' }],
        lastReactivatedAt: [{ value: 'lastReactivatedAt' }],
        statusModifiedAt: [{ value: 'statusModifiedAt' }],

        methodologies: [{ value: 'methodologies' }],

        canReadPosition: [{ read: 'canReadPosition' }],
        canEditPosition: [{ edit: 'canEditPosition' }],
        canReadStatus: [{ read: 'canReadStatus' }],
        canEditStatus: [{ edit: 'canEditStatus' }],
        canReadCompleteDate: [{ read: 'canReadCompleteDate' }],
        canEditCompleteDate: [{ edit: 'canEditCompleteDate' }],
        canReadMethodologies: [
          {
            read: 'canReadMethodologies',
          },
        ],
        canEditMethodologies: [
          {
            edit: 'canEditMethodologies',
          },
        ],
        canReadDisbursementCompleteDate: [
          {
            read: 'canReadDisbursementCompleteDate',
          },
        ],
        canEditDisbursementCompleteDate: [
          {
            edit: 'canEditDisbursementCompleteDate',
          },
        ],
        canReadCommunicationsCompleteDate: [
          {
            read: 'canReadCommunicationsCompleteDate',
          },
        ],
        canEditCommunicationsCompleteDate: [
          {
            edit: 'canEditCommunicationsCompleteDate',
          },
        ],
        canReadStartDate: [{ read: 'canReadStartDate' }],
        canEditStartDate: [{ edit: 'canEditStartDate' }],
        canReadEndDate: [{ read: 'canReadEndDate' }],
        canEditEndDate: [{ edit: 'canEditEndDate' }],

        canReadInitialEndDate: [{ read: 'canReadInitialEndDate' }],
        canEditInitialEndDate: [{ edit: 'canEditInitialEndDate' }],
        canReadLastSuspendedAt: [{ read: 'canReadLastSuspendedAt' }],
        canEditLastSuspendedAt: [{ edit: 'canEditLastSuspendedAt' }],
        canReadLastReactivatedAt: [
          {
            read: 'canReadLastReactivatedAt',
          },
        ],
        canEditLastReactivatedAt: [
          {
            edit: 'canEditLastReactivatedAt',
          },
        ],
        canReadStatusModifiedAt: [
          {
            read: 'canReadStatusModifiedAt',
          },
        ],
        canEditStatusModifiedAt: [
          {
            edit: 'canEditStatusModifiedAt',
          },
        ],
        canReadModifiedAt: [{ read: 'canReadModifiedAt' }],
        canEditModifiedAt: [{ edit: 'canEditModifiedAt' }],
      });
    let result;

    try {
      result = await ieQuery.first();
    } catch (error) {
      this.logger.error('could not read Internship Enagement', error);
    }
    if (!result || !result.id) {
      throw new NotFoundException('could not find internship Engagement');
    }

    const ceremony = result.ceremonyId
      ? await this.ceremonyService.readOne(result.ceremonyId, session)
      : undefined;

    const internUser = result.internUserId
      ? await this.userService.readOne(result.internUserId, session)
      : undefined;

    const mentorUser = result.mentorUserId
      ? await this.userService.readOne(result.mentorUserId, session)
      : undefined;

    const countryOfOrigin = result.countryOfOriginId
      ? await this.locationService.readOneCountry(
          result.countryOfOriginId,
          session
        )
      : undefined;

    const internshipEngagement = {
      position: {
        value: result.position,
        canRead: !!result.canReadPosition,
        canEdit: !!result.canEditPosition,
      },
      methodologies: {
        value: result.methodologies,
        canRead: !!result.canReadMethodologies,
        canEdit: !!result.canEditMethodologies,
      },
      intern: {
        value: internUser,
        canRead: !!result.canReadIntern,
        canEdit: !!result.canEditIntern,
      },
      mentor: {
        value: mentorUser,
        canRead: !!result.canReadMentor,
        canEdit: !!result.canEditMentor,
      },
      countryOfOrigin: {
        value: countryOfOrigin,
        canRead: !!result.canReadCountryOfOrigin,
        canEdit: !!result.canEditCountryOfOrigin,
      },
    };

    return {
      id,
      createdAt: result.createdAt,
      ...internshipEngagement,
      status: result.status,
      modifiedAt: result.modifiedAt,
      ceremony: {
        value: ceremony,
        canRead: !!result.canReadCeremony,
        canEdit: !!result.canEditCeremony,
      },
      completeDate: {
        value: result.completeDate,
        canRead: !!result.canReadCompleteDate,
        canEdit: !!result.canEditCompleteDate,
      },
      disbursementCompleteDate: {
        value: result.disbursementCompleteDate,
        canRead: !!result.CanReadDisbursementCompleteDate,
        canEdit: !!result.CanEditDisbursementCompleteDate,
      },
      communicationsCompleteDate: {
        value: result.communicationsCompleteDate,
        canRead: !!result.canReadCommunicationsCompleteDate,
        canEdit: !!result.canEditCommunicationsCompleteDate,
      },
      startDate: {
        value: result.startDate,
        canRead: !!result.canReadStartDate,
        canEdit: !!result.canEditStartDate,
      },
      endDate: {
        value: result.endDate,
        canRead: !!result.canReadEndDate,
        canEdit: !!result.canEditEndDate,
      },
      initialEndDate: {
        value: result.initialEndDate,
        canRead: !!result.canReadInitialEndDate,
        canEdit: !!result.canEditInitialEndDate,
      },
      lastSuspendedAt: {
        value: result.lastSuspendedAt,
        canRead: !!result.canReadLastSuspendedAt,
        canEdit: !!result.canEditLastSuspendedAt,
      },
      lastReactivatedAt: {
        value: result.lastReactivatedAt,
        canRead: !!result.canReadLastReactivatedAt,
        canEdit: !!result.canEditLastReactivatedAt,
      },
      statusModifiedAt: {
        value: result.statusModifiedAt,
        canRead: !!result.canReadStatusModifiedAt,
        canEdit: !!result.canEditStatusModifiedAt,
      },
    };
  }

  async updateLanguageEngagement(
    input: UpdateLanguageEngagement,
    session: ISession
  ): Promise<LanguageEngagement> {
    try {
      const changes = {
        ...input,
        modifiedAt: DateTime.local(),
      };
      const object = await this.readOne(input.id, session);
      await this.db.sgUpdateProperties({
        session,
        object,
        props: [
          'firstScripture',
          'lukePartnership',
          'completeDate',
          'disbursementCompleteDate',
          'communicationsCompleteDate',
          'startDate',
          'endDate',
          'paraTextRegistryId',
          'modifiedAt',
        ],
        changes,
        nodevar: 'LanguageEngagement',
      });

      return (await this.readOne(input.id, session)) as LanguageEngagement;
    } catch (e) {
      this.logger.error(e);
      throw new ServerException('Could not update LanguageEngagement');
    }
  }

  async updateInternshipEngagement(
    { mentorId, countryOfOriginId, ...input }: UpdateInternshipEngagement,
    session: ISession
  ): Promise<InternshipEngagement> {
    const createdAt = DateTime.local();
    try {
      if (mentorId) {
        const mentorQ = this.db
          .query()
          .match(matchSession(session))
          .match([
            node('newMentorUser', 'User', { active: true, id: mentorId }),
          ])
          .match([
            node('internshipEngagement', 'InternshipEngagement', {
              active: true,
              id: input.id,
            }),
            relation('out', 'rel', 'mentor', { active: true }),
            node('oldMentorUser', 'User'),
          ])
          .delete('rel')
          .create([
            node('internshipEngagement'),
            relation('out', '', 'mentor', {
              active: true,
              createdAt,
            }),
            node('newMentorUser'),
          ])
          .return('internshipEngagement.id as id');
        await mentorQ.first();
      }

      if (countryOfOriginId) {
        const countryQ = this.db
          .query()
          .match([
            node('newCountry', 'Country', {
              active: true,
              id: countryOfOriginId,
            }),
          ])
          .match([
            node('internshipEngagement', 'InternshipEngagement', {
              active: true,
              id: input.id,
            }),
            relation('out', 'rel', 'countryOfOrigin', { active: true }),
            node('oldCountry', 'Country'),
          ])
          .delete('rel')
          .create([
            node('internshipEngagement'),
            relation('out', '', 'countryOfOrigin', {
              active: true,
              createdAt,
            }),
            node('newCountry'),
          ])
          .return('internshipEngagement.id as id');

        await countryQ.first();
      }
      const object = await this.readInternshipEngagement(input.id, session);
      await this.db.sgUpdateProperties({
        session,
        object,
        props: [
          'position',
          'methodologies',
          'completeDate',
          'disbursementCompleteDate',
          'communicationsCompleteDate',
          'startDate',
          'endDate',
          'modifiedAt',
        ],
        changes: {
          ...input,
          modifiedAt: DateTime.local(),
        },
        nodevar: 'InternshipEngagement',
      });
      // update property node labels
      Object.keys(input).map(async (ele) => {
        if (ele === 'position') {
          await this.db.addLabelsToPropNodes(input.id, 'position', [
            'InternPosition',
          ]);
        }
        if (ele === 'methodologies') {
          await this.db.addLabelsToPropNodes(input.id, 'methodologies', [
            'ProductMethodology',
          ]);
        }
      });
      const result = await this.readInternshipEngagement(input.id, session);
      // console.log('result ', JSON.stringify(result, null, 2));

      return result as InternshipEngagement;
    } catch (e) {
      this.logger.warning('Failed to update InternshipEngagement', {
        exception: e,
      });
      throw new ServerException('Could not find update InternshipEngagement');
    }
  }

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find engagement');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });
    } catch (e) {
      this.logger.warning('Failed to delete partnership', {
        exception: e,
      });

      throw new ServerException('Failed to delete partnership');
    }
  }

  async checkEngagementConsistency(
    baseNode: string,
    session: ISession
  ): Promise<boolean> {
    const nodes = await this.db
      .query()
      .match([
        node('eng', baseNode, {
          active: true,
        }),
      ])
      .return('eng.id as id')
      .run();
    if (baseNode === 'InternshipEngagement') {
      return this.isInternshipEngagementConsistent(nodes, baseNode, session);
    }
    if (baseNode === 'LanguageEngagement') {
      return this.isLanguageEngagementConsistent(nodes, baseNode, session);
    }
    return false;
  }

  async isLanguageEngagementConsistent(
    nodes: Record<string, any>,
    baseNode: string,
    session: ISession
  ): Promise<boolean> {
    const requiredProperties: never[] = []; // add more after discussing
    return (
      (
        await Promise.all(
          nodes.map(async (ie: { id: any }) =>
            ['language'] // singletons
              .map((rel) =>
                this.db.isRelationshipUnique({
                  session,
                  id: ie.id,
                  relName: rel,
                  srcNodeLabel: 'LanguageEngagement',
                })
              )
              .every((n) => n)
          )
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          nodes.map(async (ie: { id: any }) =>
            this.db.hasProperties({
              session,
              id: ie.id,
              props: requiredProperties,
              nodevar: 'LanguageEngagement',
            })
          )
        )
      ).every((n) => n)
    );
  }

  async isInternshipEngagementConsistent(
    nodes: Record<string, any>,
    baseNode: string,
    session: ISession
  ): Promise<boolean> {
    // right now all properties are optional
    const requiredProperties: never[] = [];
    return (
      (
        await Promise.all(
          nodes.map(async (ie: { id: any }) =>
            ['intern'] // optional – mentor, status, ceremony, countryOfOrigin
              .map((rel) =>
                this.db.isRelationshipUnique({
                  session,
                  id: ie.id,
                  relName: rel,
                  srcNodeLabel: 'InternshipEngagement',
                })
              )
              .every((n) => n)
          )
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          nodes.map(async (ie: { id: any }) =>
            this.db.hasProperties({
              session,
              id: ie.id,
              props: requiredProperties,
              nodevar: 'InternshipEngagement',
            })
          )
        )
      ).every((n) => n)
    );
  }
}
