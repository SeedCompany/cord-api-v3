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
  addAllMetaPropertiesOfChildBaseNodes,
  addAllSecureProperties,
  addPropertyCoalesceWithClause,
  addShapeForBaseNodeMetaProperty,
  addShapeForChildBaseNodeMetaProperty,
  ChildBaseNodeMetaProperty,
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  matchUserPermissions,
} from '../../core';
import { CeremonyService } from '../ceremony';
import { CeremonyType } from '../ceremony/dto/type.enum';
import { FileService } from '../file';
import {
  ProductListInput,
  ProductService,
  SecuredProductList,
} from '../product';
import { ProjectType } from '../project/dto/type.enum';
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
    private readonly config: ConfigService,
    private readonly files: FileService,
    @Logger(`engagement.service`) private readonly logger: ILogger
  ) {}

  // HELPER //////////////////////////////////////////////////////////

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
  property = (prop: string, value: any | null, baseNode: string) => {
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

  protected async getProjectTypeById(
    projectId: string
  ): Promise<ProjectType | undefined> {
    const qr = `
    MATCH (p:Project {id: $projectId, active: true}) RETURN p.type as type
    `;
    const results = await this.db.query().raw(qr, { projectId }).first();

    return results?.type as ProjectType | undefined;
  }

  // CREATE /////////////////////////////////////////////////////////

  async createLanguageEngagement(
    { languageId, projectId, ...input }: CreateLanguageEngagement,
    session: ISession
  ): Promise<LanguageEngagement> {
    // LanguageEngagements can only be created on TranslationProjects
    const projectType = await this.getProjectTypeById(projectId);

    if (projectType && projectType !== ProjectType.Translation) {
      throw new BadRequestException('That Project type is not Translation');
    }

    this.logger.info('Mutation create language engagement ', {
      input,
      projectId,
      languageId,
      userId: session.userId,
    });

    // Initial LanguageEngagement
    const id = generate();
    const createdAt = DateTime.local();
    const pnp = await this.files.createDefinedFile(`PNP`, session, input.pnp);

    const ceremony = await this.ceremonyService.create(
      { type: CeremonyType.Dedication },
      session
    );

    this.logger.info('ceremony created: ', ceremony);
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
        'endDate',
        input.endDate || undefined,
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
      ...this.property('pnp', pnp || undefined, 'languageEngagement'),
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
        ...this.permission('pnp', 'languageEngagement'),
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
    const res = await this.readLanguageEngagement(id, session);
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
    // InternshipEngagements can only be created on InternshipProjects
    const projectType = await this.getProjectTypeById(projectId);

    if (projectType && projectType !== ProjectType.Internship) {
      throw new BadRequestException('That Project type is not Intership');
    }

    this.logger.info('Mutation create internship engagement ', {
      input,
      projectId,
      mentorId,
      countryOfOriginId,
      userId: session.userId,
    });
    const id = generate();
    const createdAt = DateTime.local();
    const growthPlan = await this.files.createDefinedFile(
      `Growth Plan`,
      session,
      input.growthPlan
    );

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
        'growthPlan',
        growthPlan || undefined,
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
        ...this.permission('growthPlan', 'internshipEngagement'),
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
      return await this.readInternshipEngagement(id, session);
    } catch (e) {
      this.logger.error(e);

      throw new ServerException(`Could not create InternshipEngagement`);
    }
  }

  // READ ///////////////////////////////////////////////////////////

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
  ): Promise<LanguageEngagement> {
    this.logger.debug('readLanguageEngagement', { id, userId: session.userId });

    if (!session.userId) {
      this.logger.info('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    const props = [
      'firstScripture',
      'lukePartnership',
      'sentPrintingDate',
      'completeDate',
      'startDate',
      'endDate',
      'disbursementCompleteDate',
      'communicationsCompleteDate',
      'initialEndDate',
      'lastSuspendedAt',
      'lastReactivatedAt',
      'statusModifiedAt',
      'status',
      'modifiedAt',
      'paraTextRegistryId',
      'pnp',
    ];

    const baseNodeMetaProps = ['id', 'createdAt'];

    const childBaseNodeMetaProps: ChildBaseNodeMetaProperty[] = [
      {
        parentBaseNodePropertyKey: 'ceremony',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'Ceremony',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'ceremonyId',
      },
      {
        parentBaseNodePropertyKey: 'language',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'Language',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'languageId',
      },
    ];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'LanguageEngagement', id)
      .call(addAllSecureProperties, ...props)
      .call(addAllMetaPropertiesOfChildBaseNodes, ...childBaseNodeMetaProps)
      .with([
        ...props.map(addPropertyCoalesceWithClause),
        ...childBaseNodeMetaProps.map(addShapeForChildBaseNodeMetaProperty),
        ...baseNodeMetaProps.map(addShapeForBaseNodeMetaProperty),
      ])
      .returnDistinct([
        ...props,
        ...baseNodeMetaProps,
        ...childBaseNodeMetaProps.map((x) => x.returnIdentifier),
      ]);

    let result;

    try {
      result = await query.first();
    } catch (error) {
      this.logger.error('could not read Language Enagement', error);
    }
    if (!result || !result.id) {
      throw new NotFoundException('could not find language Engagement');
    }

    // todo: refactor with/return query to remove the need to do mapping
    const response = {
      ...result,
      language: {
        value: result.languageId,
        canRead: !!result.canReadLanguage,
        canEdit: !!result.canEditLanguage,
      },
      ceremony: {
        value: result.ceremonyId,
        canRead: !!result.canReadCeremony,
        canEdit: !!result.canEditCeremony,
      },
      status: result.status.value,
      modifiedAt: result.modifiedAt.value,
    };

    return response as LanguageEngagement;
  }

  async readInternshipEngagement(
    id: string,
    session: ISession
  ): Promise<InternshipEngagement> {
    this.logger.debug('readInternshipEngagement', {
      id,
      userId: session.userId,
    });

    if (!session.userId) {
      this.logger.info('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    const props = [
      'modifiedAt',
      'status',
      'startDate',
      'completeDate',
      'position',
      'endDate',
      'disbursementCompleteDate',
      'communicationsCompleteDate',
      'initialEndDate',
      'lastSuspendedAt',
      'lastReactivatedAt',
      'statusModifiedAt',
      'methodologies',
      'growthPlan',
    ];

    const baseNodeMetaProps = ['id', 'createdAt'];

    const childBaseNodeMetaProps: ChildBaseNodeMetaProperty[] = [
      {
        parentBaseNodePropertyKey: 'ceremony',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'Ceremony',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'ceremonyId',
      },
      {
        parentBaseNodePropertyKey: 'intern',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'User',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'internUserId',
      },
      {
        parentBaseNodePropertyKey: 'countryOfOrigin',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'Country',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'countryOfOriginId',
      },
      {
        parentBaseNodePropertyKey: 'mentor',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'User',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'mentorUserId',
      },
    ];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'InternshipEngagement', id)
      .call(addAllSecureProperties, ...props)
      .call(addAllMetaPropertiesOfChildBaseNodes, ...childBaseNodeMetaProps)
      .with([
        ...props.map(addPropertyCoalesceWithClause),
        ...childBaseNodeMetaProps.map(addShapeForChildBaseNodeMetaProperty),
        ...baseNodeMetaProps.map(addShapeForBaseNodeMetaProperty),
      ])
      .returnDistinct([
        ...props,
        ...baseNodeMetaProps,
        ...childBaseNodeMetaProps.map((x) => x.returnIdentifier),
      ]);

    let result;

    try {
      result = await query.first();
    } catch (error) {
      this.logger.error('could not read Internship Enagement', error);
    }
    if (!result || !result.id) {
      throw new NotFoundException('could not find internship Engagement');
    }

    // todo: refactor with/return query to remove the need to do mapping
    const response = {
      ...result,
      methodologies: {
        value: result.methodologies.value ? result.methodologies.value : [],
        canRead: !!result.canReadMethodologies,
        canEdit: !!result.canEditMethodologies,
      },
      ceremony: {
        value: result.ceremonyId,
        canRead: !!result.canReadCeremony,
        canEdit: !!result.canEditCeremony,
      },
      countryOfOrigin: {
        value: result.countryOfOriginId,
        canRead: !!result.canReadCountryOfOrigin,
        canEdit: !!result.canEditCountryOfOrigin,
      },
      intern: {
        value: result.internUserId,
        canRead: !!result.canReadIntern,
        canEdit: !!result.canEditIntern,
      },
      mentor: {
        value: result.mentorUserId,
        canRead: !!result.canReadMentor,
        canEdit: !!result.canEditMentor,
      },
      status: result.status.value,
      modifiedAt: result.modifiedAt.value,
    };

    return response as InternshipEngagement;
  }

  // UPDATE /////////////////////////////////////////////////////////

  async updateLanguageEngagement(
    input: UpdateLanguageEngagement,
    session: ISession
  ): Promise<LanguageEngagement> {
    try {
      const { pnp, ...rest } = input;
      const changes = {
        ...rest,
        modifiedAt: DateTime.local(),
      };
      const object = await this.readLanguageEngagement(input.id, session);
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
      await this.files.updateDefinedFile(object.pnp, pnp, session);

      return await this.readLanguageEngagement(input.id, session);
    } catch (e) {
      this.logger.error('Error updating language engagement', { exception: e });
      throw new ServerException('Could not update LanguageEngagement');
    }
  }

  async updateInternshipEngagement(
    {
      growthPlan,
      mentorId,
      countryOfOriginId,
      ...input
    }: UpdateInternshipEngagement,
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
      await this.files.updateDefinedFile(
        object.growthPlan,
        growthPlan,
        session
      );

      const result = await this.readInternshipEngagement(input.id, session);

      return result;
    } catch (e) {
      this.logger.warning('Failed to update InternshipEngagement', {
        exception: e,
      });
      throw new ServerException('Could not find update InternshipEngagement');
    }
  }

  // DELETE /////////////////////////////////////////////////////////

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

  // LIST ///////////////////////////////////////////////////////////

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

  // CONSISTENCY ////////////////////////////////////////////////////

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
