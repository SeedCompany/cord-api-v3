import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { generate } from 'shortid';
import {
  DuplicateException,
  InputException,
  ISession,
  NotFoundException,
  ServerException,
  UnauthenticatedException,
} from '../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import {
  DbPropsOfDto,
  parseBaseNodeProperties,
  parsePropList,
  parseSecuredProperties,
  runListQuery,
  StandardReadResult,
} from '../../core/database/results';
import { CeremonyService } from '../ceremony';
import { CeremonyType } from '../ceremony/dto/type.enum';
import { FileService } from '../file';
import {
  ProductListInput,
  ProductService,
  SecuredProductList,
} from '../product';
import { ProjectType } from '../project/dto/type.enum';
import { ProjectService } from '../project/project.service';
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

@Injectable()
export class EngagementService {
  private readonly securedProperties = {
    status: true,
    statusModifiedAt: true,
    completeDate: true,
    disbursementCompleteDate: true,
    communicationsCompleteDate: true,
    initialEndDate: true,
    startDate: true,
    endDate: true,
    startDateOverride: true,
    endDateOverride: true,
    modifiedAt: true,
    lastSuspendedAt: true,
    lastReactivatedAt: true,
    ceremony: true,

    //Language Specific
    firstScripture: true,
    lukePartnership: true,
    sentPrintingDate: true,
    paraTextRegistryId: true,
    pnp: true,
    language: true,

    //Internship Specific
    position: true,
    growthPlan: true,
    methodologies: true,
    intern: true,
    mentor: true,
    countryOfOrigin: true,
  };

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
  ): Promise<boolean> {
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
  ): Promise<boolean> {
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
      throw new UnauthenticatedException('user not logged in');
    }
    // LanguageEngagements can only be created on TranslationProjects
    const projectType = await this.getProjectTypeById(projectId);

    if (projectType && projectType !== ProjectType.Translation) {
      throw new InputException(
        'That Project type is not Translation',
        'engagement.projectId'
      );
    }

    if (await this.getLEByProjectAndLanguage(projectId, languageId)) {
      throw new DuplicateException(
        'engagement.languageId',
        'Engagement for this project and language already exists'
      );
    }

    this.logger.debug('Mutation create language engagement ', {
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

    this.logger.debug('ceremony created: ', ceremony);
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
        input.status || EngagementStatus.InDevelopment,
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
    } catch (exception) {
      this.logger.error('could not create Language Engagement ', { exception });
      throw new ServerException(
        'Could not create Langauge Engagement',
        exception
      );
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
        throw new InputException(
          'projectId is invalid',
          'engagement.projectId'
        );
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
        throw new InputException(
          'languageId is invalid',
          'engagement.languageId'
        );
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
      throw new UnauthenticatedException('user not logged in');
    }
    // InternshipEngagements can only be created on InternshipProjects
    const projectType = await this.getProjectTypeById(projectId);

    if (projectType && projectType !== ProjectType.Internship) {
      throw new InputException(
        'That Project type is not Internship',
        'engagement.projectId'
      );
    }

    if (await this.getIEByProjectAndIntern(projectId, internId)) {
      throw new DuplicateException(
        'engagement.internId',
        'Engagement for this project and person already exists'
      );
    }

    this.logger.debug('Mutation create internship engagement ', {
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
      throw new ServerException('could not create ceremony', e);
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
        input.status || EngagementStatus.InDevelopment,
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
    } catch (exception) {
      // secondary queries to see what ID is bad
      // check internId

      this.logger.error('could not create Internship Engagement ', {
        exception,
      });
      throw new ServerException(
        'Could not create Internship Engagement',
        exception
      );
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
        throw new InputException('internId is invalid', 'engagement.internId');
      }
      if (
        mentorId &&
        !(await this.db
          .query()
          .match([node('mentor', 'User', { active: true, id: mentorId })])
          .return('mentor.id')
          .first())
      ) {
        throw new InputException('mentorId is invalid', 'engagement.mentorId');
      }
      if (
        projectId &&
        !(await this.db
          .query()
          .match([node('project', 'Project', { active: true, id: projectId })])
          .return('project.id')
          .first())
      ) {
        throw new InputException(
          'projectId is invalid',
          'engagement.projectId'
        );
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
        throw new InputException(
          'countryOfOriginId is invalid',
          'engagement.countryOfOriginId'
        );
      }
      throw new ServerException('Could not create Internship Engagement');
    }
    try {
      return (await this.readOne(id, session)) as InternshipEngagement;
    } catch (e) {
      this.logger.error(e);

      throw new ServerException(`Could not create InternshipEngagement`, e);
    }
  }

  // READ ///////////////////////////////////////////////////////////

  async readOne(
    id: string,
    session: ISession
  ): Promise<LanguageEngagement | InternshipEngagement> {
    this.logger.debug('readOne', { id, userId: session.userId });

    if (!id) {
      throw new NotFoundException('no id given', 'engagement.id');
    }

    if (!session.userId) {
      this.logger.debug('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Engagement', { active: true, id })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member*1..'),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission'),
        node('perms', 'Permission', { active: true }),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .with('collect(distinct perms) as permList, node')
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('props', 'Property', { active: true }),
      ])
      .with('{value: props.value, property: type(r)} as prop, permList, node')
      .with([
        'collect(prop) as propList',
        'permList',
        'node',
        `case
          when 'InternshipEngagement' IN labels(node)
          then 'InternshipEngagement'
          when 'LanguageEngagement' IN labels(node)
          then 'LanguageEngagement'
          end as __typename
          `,
      ])
      .optionalMatch([
        node('project'),
        relation('out', '', 'engagement', { active: true }),
        node('node'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'ceremony', { active: true }),
        node('ceremony'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'language', { active: true }),
        node('language'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'intern', { active: true }),
        node('intern'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'countryOfOrigin', { active: true }),
        node('countryOfOrigin'),
      ])
      .optionalMatch([
        node('node'),
        relation('out', '', 'mentor', { active: true }),
        node('mentor'),
      ])
      .return([
        'propList, permList, node, project.id as projectId',
        '__typename, ceremony.id as ceremonyId',
        'language.id as languageId',
        'intern.id as internId',
        'countryOfOrigin.id as countryOfOriginId',
        'mentor.id as mentorId',
      ])
      .asResult<
        StandardReadResult<
          DbPropsOfDto<LanguageEngagement & InternshipEngagement>
        > & {
          __typename: string;
          languageId: string;
          ceremonyId: string;
          projectId: string;
          internId: string;
          countryOfOriginId: string;
          mentorId: string;
        }
      >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('could not find Engagement', 'engagement.id');
    }

    const props = parsePropList(result.propList);
    const securedProperties = parseSecuredProperties(
      props,
      result.permList,
      this.securedProperties
    );

    const project = await this.projectService.readOne(
      result.projectId,
      session
    );

    const canReadStartDate =
      project.mouStart.canRead && securedProperties.startDateOverride.canRead;
    const startDate = canReadStartDate
      ? props.startDateOverride ?? project.mouStart.value
      : null;
    const canReadEndDate =
      project.mouEnd.canRead && securedProperties.endDateOverride.canRead;
    const endDate = canReadEndDate
      ? props.endDateOverride ?? project.mouEnd.value
      : null;

    return {
      __typename: result.__typename,
      ...securedProperties,
      ...parseBaseNodeProperties(result.node),
      status: props.status,
      modifiedAt: props.modifiedAt,
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
      methodologies: {
        ...securedProperties.methodologies,
        value: securedProperties.methodologies.value ?? [],
      },
      ceremony: {
        ...securedProperties.ceremony,
        value: result.ceremonyId,
      },
      language: {
        ...securedProperties.language,
        value: result.languageId,
      },
      intern: {
        ...securedProperties.intern,
        value: result.internId,
      },
      countryOfOrigin: {
        ...securedProperties.countryOfOrigin,
        value: result.countryOfOriginId,
      },
      mentor: {
        ...securedProperties.mentor,
        value: result.mentorId,
      },
    };
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
          'status',
        ],
        changes,
        nodevar: 'LanguageEngagement',
      });
    } catch (exception) {
      this.logger.error('Error updating language engagement', { exception });
      throw new ServerException(
        'Could not update LanguageEngagement',
        exception
      );
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
          'status',
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
    } catch (exception) {
      this.logger.warning('Failed to update InternshipEngagement', {
        exception,
      });
      throw new ServerException(
        'Could not find update InternshipEngagement',
        exception
      );
    }

    return (await this.readOne(input.id, session)) as InternshipEngagement;
  }

  // DELETE /////////////////////////////////////////////////////////

  async delete(id: string, session: ISession): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find engagement', 'engagement.id');
    }

    try {
      await this.db.deleteNode({
        session,
        object,
        aclEditProp: 'canDeleteOwnUser',
      });

      const ceremonyId = object.ceremony?.value;

      if (ceremonyId) {
        const ceremony = await this.ceremonyService.readOne(
          ceremonyId,
          session
        );

        if (ceremony) {
          await this.db.deleteNode({
            session,
            object: ceremony,
            aclEditProp: 'canDeleteOwnUser',
          });
        }
      }
    } catch (exception) {
      this.logger.warning('Failed to delete partnership', {
        exception,
      });

      throw new ServerException('Failed to delete partnership', exception);
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

    const query = this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode(label),
        ...(filter.projectId
          ? [
              relation('in', '', 'engagement', { active: true }),
              node('project', 'Project', {
                active: true,
                id: filter.projectId,
              }),
            ]
          : []),
      ])
      .call(calculateTotalAndPaginateList, input, (q, sort, order) =>
        sort in this.securedProperties
          ? q
              .match([
                node('node'),
                relation('out', '', sort),
                node('prop', 'Property', { active: true }),
              ])
              .with('*')
              .orderBy('prop.value', order)
          : q.with('*').orderBy(`node.${sort}`, order)
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
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
      return await this.isInternshipEngagementConsistent(
        nodes,
        baseNode,
        session
      );
    }
    if (baseNode === 'LanguageEngagement') {
      return await this.isLanguageEngagementConsistent(
        nodes,
        baseNode,
        session
      );
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
          nodes.map(
            async (ie: { id: any }) =>
              await this.db.hasProperties({
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
          nodes.map(
            async (ie: { id: any }) =>
              await this.db.hasProperties({
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
