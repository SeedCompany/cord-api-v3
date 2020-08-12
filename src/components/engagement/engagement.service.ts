/* eslint-disable */

import {
  BadRequestException,
  Injectable,
  NotFoundException,
  InternalServerErrorException as ServerException,
  UnauthorizedException,
  forwardRef,
  Inject,
} from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { isFunction, upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import { ISession, DuplicateException } from '../../common';
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
  listWithSecureObject,
  listWithUnsecureObject,
  printActualQuery,
  addBaseNodeMetaPropsWithClause,
  runListQuery,
  filterByString,
  filterByBaseNodeId,
  matchUserPermissionsForList,
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
  EngagementListInput,
  EngagementListOutput,
  EngagementStatus,
  InternshipEngagement,
  LanguageEngagement,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';
import { ProjectService } from '../project/project.service';

@Injectable()
export class EngagementService {
  constructor(
    private readonly db: DatabaseService,
    private readonly ceremonyService: CeremonyService,
    private readonly products: ProductService,
    private readonly config: ConfigService,
    private readonly files: FileService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
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

  protected async getIEByProjectAndIntern(
    projectId: string,
    internId: string
  ): Promise<Boolean> {
    const result = await this.db
      .query()
      .match([node('intern', 'User', { active: true, id: internId })])
      .match([node('project', 'Project', { active: true, id: projectId })])
      .match([
        node('project'),
        relation('out', '', 'engagement'),
        node('internshipEngagement'),
        relation('out', '', 'intern'),
        node('intern'),
      ])
      .return('internshipEngagement.id as id')
      .first();

    return result ? true : false;
  }

  protected async getLEByProjectAndLanguage(
    projectId: string,
    languageId: string
  ): Promise<Boolean> {
    const result = await this.db
      .query()
      .match([node('language', 'Language', { active: true, id: languageId })])
      .match([node('project', 'Project', { active: true, id: projectId })])
      .match([
        node('project'),
        relation('out', '', 'engagement'),
        node('internshipEngagement'),
        relation('out', '', 'language'),
        node('language'),
      ])
      .return('internshipEngagement.id as id')
      .first();

    return result ? true : false;
  }

  // CREATE /////////////////////////////////////////////////////////

  async createLanguageEngagement(
    { languageId, projectId, ...input }: CreateLanguageEngagement,
    session: ISession
  ): Promise<LanguageEngagement> {
    if (!session.userId) {
      throw new UnauthorizedException('user not logged in');
    }
    // LanguageEngagements can only be created on TranslationProjects
    const projectType = await this.getProjectTypeById(projectId);

    if (projectType && projectType !== ProjectType.Translation) {
      throw new BadRequestException('That Project type is not Translation');
    }

    if (await this.getLEByProjectAndLanguage(projectId, languageId)) {
      throw new DuplicateException(
        'engagement.languageId',
        'Engagement for this project and language already exists'
      );
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
    const pnp = await this.files.createDefinedFile(
      `PNP`,
      session,
      input.pnp,
      'engagement.pnp'
    );

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
        node(
          'languageEngagement',
          ['LanguageEngagement', 'Engagement', 'BaseNode'],
          {
            active: true,
            createdAt,
            id,
            owningOrgId: session.owningOrgId,
          }
        ),
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
        'startDateOverride',
        input.startDateOverride || undefined,
        'languageEngagement'
      ),
      ...this.property(
        'endDateOverride',
        input.endDateOverride || undefined,
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
    createLE.create([
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
      ...this.permission('firstScripture', 'languageEngagement'),
      ...this.permission('lukePartnership', 'languageEngagement'),
      ...this.permission('completeDate', 'languageEngagement'),
      ...this.permission('disbursementCompleteDate', 'languageEngagement'),
      ...this.permission('communicationsCompleteDate', 'languageEngagement'),
      ...this.permission('startDateOverride', 'languageEngagement'),
      ...this.permission('endDateOverride', 'languageEngagement'),
      ...this.permission('ceremony', 'languageEngagement'),
      ...this.permission('language', 'languageEngagement'),
      ...this.permission('status', 'languageEngagement'),
      ...this.permission('paraTextRegistryId', 'languageEngagement'),
      ...this.permission('pnp', 'languageEngagement'),
      ...this.permission('modifiedAt', 'languageEngagement'),
    ]);
    if (session.userId !== this.config.rootAdmin.id) {
      createLE.create([
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
      ]);
    }
    createLE.return('languageEngagement');
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
    const res = (await this.readOne(id, session)) as LanguageEngagement;
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
    if (!session.userId) {
      throw new UnauthorizedException('user not logged in');
    }
    // InternshipEngagements can only be created on InternshipProjects
    const projectType = await this.getProjectTypeById(projectId);

    if (projectType && projectType !== ProjectType.Internship) {
      throw new BadRequestException('That Project type is not Intership');
    }

    if (await this.getIEByProjectAndIntern(projectId, internId)) {
      throw new DuplicateException(
        'engagement.internId',
        'Engagement for this project and person already exists'
      );
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
      input.growthPlan,
      'engagement.growthPlan'
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
        node(
          'internshipEngagement',
          ['InternshipEngagement', 'Engagement', 'BaseNode'],
          {
            active: true,
            createdAt,
            id,
            owningOrgId: session.owningOrgId,
          }
        ),
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
        'startDateOverride',
        input.startDateOverride || undefined,
        'internshipEngagement'
      ),
      ...this.property(
        'endDateOverride',
        input.endDateOverride || undefined,
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
    createIE.create([
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
      ...this.permission('completeDate', 'internshipEngagement'),
      ...this.permission('communicationsCompleteDate', 'internshipEngagement'),
      ...this.permission('disbursementCompleteDate', 'internshipEngagement'),
      ...this.permission('methodologies', 'internshipEngagement'),
      ...this.permission('position', 'internshipEngagement'),
      ...this.permission('modifiedAt', 'internshipEngagement'),
      ...this.permission('startDateOverride', 'internshipEngagement'),
      ...this.permission('endDateOverride', 'internshipEngagement'),
      ...this.permission('language', 'internshipEngagement'),
      ...this.permission('status', 'internshipEngagement'),
      ...this.permission('countryOfOrigin', 'internshipEngagement'),
      ...this.permission('ceremony', 'internshipEngagement'),
      ...this.permission('intern', 'internshipEngagement'),
      ...this.permission('mentor', 'internshipEngagement'),
      ...this.permission('growthPlan', 'internshipEngagement'),
    ]);
    if (session.userId !== this.config.rootAdmin.id) {
      createIE.create([
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
      ]);
    }
    createIE.return('internshipEngagement');
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
      return (await this.readOne(id, session)) as InternshipEngagement;
    } catch (e) {
      this.logger.error(e);

      throw new ServerException(`Could not create InternshipEngagement`);
    }
  }

  // READ ///////////////////////////////////////////////////////////

  async readOne(
    id: string,
    session: ISession
  ): Promise<LanguageEngagement | InternshipEngagement> {
    this.logger.info('readOne', { id, userId: session.userId });

    if (!id) {
      throw new NotFoundException('no id given');
    }

    if (!session.userId) {
      this.logger.info('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    const props = [
      // Engagement
      'status',
      'statusModifiedAt',
      'completeDate',
      'disbursementCompleteDate',
      'communicationsCompleteDate',
      'initialEndDate',
      'startDate',
      'endDate',
      'startDateOverride',
      'endDateOverride',
      'modifiedAt',
      'lastSuspendedAt',
      'lastReactivatedAt',

      // Language specific
      'firstScripture',
      'lukePartnership',
      'sentPrintingDate',
      'paraTextRegistryId',
      'pnp',

      // Internship specific
      'position',
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
        parentBaseNodePropertyKey: 'language',
        parentRelationDirection: 'out',
        childBaseNodeLabel: 'Language',
        childBaseNodeMetaPropertyKey: 'id',
        returnIdentifier: 'languageId',
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
      .call(matchUserPermissions, 'Engagement', id)
      .call(addAllSecureProperties, ...props)
      .call(addAllMetaPropertiesOfChildBaseNodes, ...childBaseNodeMetaProps)
      .optionalMatch([
        node('project'),
        relation('out', '', 'engagement', { active: true }),
        node('node'),
      ])
      .with([
        ...props.map(addPropertyCoalesceWithClause),
        ...childBaseNodeMetaProps.map(addShapeForChildBaseNodeMetaProperty),
        ...baseNodeMetaProps.map(addShapeForBaseNodeMetaProperty),
        'node',
        'project.id as projectId',
        `
          case
          when 'InternshipEngagement' IN labels(node)
          then 'InternshipEngagement'
          when 'LanguageEngagement' IN labels(node)
          then 'LanguageEngagement'
          end as __typename
        `,
        `
        {
          value: ceremony.id,
          canRead: coalesce(ceremonyReadPerm.read, false),
          canEdit: coalesce(ceremonyEditPerm.edit, false)
        } as ceremony
      `,
        `
        {
          value: language.id,
          canRead: coalesce(languageReadPerm.read, false),
          canEdit: coalesce(languageEditPerm.edit, false)
        } as language
      `,
        `
        {
          value: intern.id,
          canRead: coalesce(internReadPerm.read, false),
          canEdit: coalesce(internEditPerm.edit, false)
        } as intern
      `,
        `
        {
          value: countryOfOrigin.id,
          canRead: coalesce(countryOfOriginReadPerm.read, false),
          canEdit: coalesce(countryOfOriginEditPerm.edit, false)
        } as countryOfOrigin
      `,
        `
        {
          value: mentor.id,
          canRead: coalesce(mentorReadPerm.read, false),
          canEdit: coalesce(mentorEditPerm.edit, false)
        } as mentor
        `,
      ])
      .returnDistinct([
        ...props,
        ...baseNodeMetaProps,
        ...childBaseNodeMetaProps.map((x) => x.returnIdentifier),
        'projectId',
        'ceremony',
        'language',
        'intern',
        'mentor',
        'countryOfOrigin',
        'labels(node) as labels',
        '__typename',
      ]);

    let result;

    // printActualQuery(this.logger, query);

    try {
      result = await query.first();
    } catch (error) {
      this.logger.error('could not read Enagement', error);
    }
    if (!result || !result.id) {
      throw new NotFoundException('could not find Engagement');
    }

    const readProject = await this.projectService.readOne(
      result?.projectId,
      session
    );

    const canReadStartDate =
      readProject.mouStart.canRead && result.startDateOverride.canRead;
    const startDate = canReadStartDate
      ? result.startDateOverride.value ?? readProject.mouStart.value
      : null;
    const canReadEndDate =
      readProject.mouEnd.canRead && result.endDateOverride.canRead;
    const endDate = canReadEndDate
      ? result.endDateOverride.value ?? readProject.mouEnd.value
      : null;

    // todo: refactor with/return query to remove the need to do mapping
    const response: any = {
      ...result,
      status: result.status.value,
      modifiedAt: result.modifiedAt.value,
      methodologies: {
        value: result.methodologies.value ? result.methodologies.value : [],
        canRead: !!result.canReadMethodologies,
        canEdit: !!result.canEditMethodologies,
      },
      startDate: {
        value: startDate,
        canRead: canReadStartDate,
        canEdit: false,
      },
      endDate: {
        value: endDate,
        canRead: canReadEndDate,
        canEdit: false,
      },
    };

    if (result.__typename === 'LanguageEngagement') {
      return (response as unknown) as LanguageEngagement;
    } else if (result.__typename === 'InternshipEngagement') {
      return (response as unknown) as InternshipEngagement;
    } else {
      throw new NotFoundException('could not find Engagement');
    }
  }

  // UPDATE ////////////////////////////////////////////////////////

  async updateLanguageEngagement(
    input: UpdateLanguageEngagement,
    session: ISession
  ): Promise<LanguageEngagement> {
    const { pnp, ...rest } = input;
    const changes = {
      ...rest,
      modifiedAt: DateTime.local(),
    };
    const object = (await this.readOne(
      input.id,
      session
    )) as LanguageEngagement;

    await this.files.updateDefinedFile(
      object.pnp,
      'engagement.pnp',
      pnp,
      session
    );

    try {
      await this.db.sgUpdateProperties({
        session,
        object,
        props: [
          'firstScripture',
          'lukePartnership',
          'completeDate',
          'disbursementCompleteDate',
          'communicationsCompleteDate',
          'startDateOverride',
          'endDateOverride',
          'paraTextRegistryId',
          'modifiedAt',
        ],
        changes,
        nodevar: 'LanguageEngagement',
      });
    } catch (e) {
      this.logger.error('Error updating language engagement', { exception: e });
      throw new ServerException('Could not update LanguageEngagement');
    }

    return (await this.readOne(input.id, session)) as LanguageEngagement;
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

    const object = (await this.readOne(
      input.id,
      session
    )) as InternshipEngagement;

    await this.files.updateDefinedFile(
      object.growthPlan,
      'engagement.growthPlan',
      growthPlan,
      session
    );

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

      await this.db.sgUpdateProperties({
        session,
        object,
        props: [
          'position',
          'methodologies',
          'completeDate',
          'disbursementCompleteDate',
          'communicationsCompleteDate',
          'startDateOverride',
          'endDateOverride',
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
    } catch (e) {
      this.logger.warning('Failed to update InternshipEngagement', {
        exception: e,
      });
      throw new ServerException('Could not find update InternshipEngagement');
    }

    return (await this.readOne(input.id, session)) as InternshipEngagement;
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
    { filter, ...input }: EngagementListInput,
    session: ISession
  ): Promise<EngagementListOutput> {
    let label = 'Engagement';
    if (filter.type === 'language') {
      label = 'LanguageEngagement';
    } else if (filter.type === 'internship') {
      label = 'InternshipEngagement';
    }

    const secureProps = [
      // Engagement
      'statusModifiedAt',
      'completeDate',
      'disbursementCompleteDate',
      'communicationsCompleteDate',
      'initialEndDate',
      'startDate',
      'endDate',
      'lastSuspendedAt',
      'lastReactivatedAt',

      // Language specific
      'firstScripture',
      'lukePartnership',
      'sentPrintingDate',
      'paraTextRegistryId',
      'pnp',

      // Internship specific
      'position',
      'growthPlan',
    ];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissionsForList, label, input.page, input.count);

    if (filter.projectId) {
      query.call(
        filterByBaseNodeId,
        filter.projectId,
        'engagement',
        'in',
        'Project',
        label
      );
    }

    const result = await runListQuery(
      query,
      input,
      secureProps.includes(input.sort)
    );

    const items = await Promise.all(
      result.items.map((row: any) => this.readOne(row.properties.id, session))
    );

    return {
      items,
      hasMore: result.hasMore,
      total: result.total,
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

    const permission = await this.db
      .query()
      .call(matchRequestingUser, session)
      .match([
        [
          node('requestingUser'),
          relation('in', '', 'member', { active: true }),
          node('', 'SecurityGroup', { active: true }),
          relation('out', '', 'permission', { active: true }),
          node('canRead', 'Permission', {
            property: 'product',
            active: true,
            read: true,
          }),
        ],
      ])
      .return({
        canRead: [{ read: 'canRead', edit: 'canEdit' }],
      })
      .first();

    return {
      ...result,
      canRead: !!permission?.canRead,
      canCreate: !!permission?.canEdit,
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
