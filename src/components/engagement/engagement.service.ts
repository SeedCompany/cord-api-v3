import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, Node, Query, relation } from 'cypher-query-builder';
import { pickBy } from 'lodash';
import { DateTime } from 'luxon';
import { Except, MergeExclusive } from 'type-fest';
import {
  DuplicateException,
  generateId,
  InputException,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import {
  ConfigService,
  DatabaseService,
  IEventBus,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  defaultSorter,
  matchPermList,
  matchPropList,
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
import { AuthorizationService } from '../authorization/authorization.service';
import { CeremonyService } from '../ceremony';
import { FileService } from '../file';
import {
  ProductListInput,
  ProductService,
  SecuredProductList,
} from '../product';
import { ProjectStatus } from '../project';
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
  PnpData,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';
import { EngagementRules } from './engagement.rules';
import {
  EngagementCreatedEvent,
  EngagementDeletedEvent,
  EngagementUpdatedEvent,
} from './events';
import { DbInternshipEngagement, DbLanguageEngagement } from './model';
import { PnpExtractor } from './pnp-extractor.service';

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
    paratextRegistryId: true,
    pnp: true,
    language: true,
    historicGoal: true,

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
    private readonly pnpExtractor: PnpExtractor,
    private readonly engagementRules: EngagementRules,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    private readonly eventBus: IEventBus,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    @Logger(`engagement.service`) private readonly logger: ILogger
  ) {}

  // CREATE /////////////////////////////////////////////////////////

  async createLanguageEngagement(
    { languageId, projectId, ...input }: CreateLanguageEngagement,
    session: Session
  ): Promise<LanguageEngagement> {
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

    if (input.firstScripture) {
      await this.verifyFirstScripture({ languageId });
    }
    // await this.verifyProjectStatus(projectId, session);

    if (input.status && input.status !== EngagementStatus.InDevelopment) {
      throw new InputException(
        'The Engagement status should be in development',
        'engagement.status'
      );
    }

    this.logger.debug('Mutation create language engagement ', {
      input,
      projectId,
      languageId,
      userId: session.userId,
    });

    // Initial LanguageEngagement
    const id = await generateId();
    const createdAt = DateTime.local();
    const pnpId = await generateId();

    const createLE = this.db.query();
    if (projectId) {
      createLE.match([node('project', 'Project', { id: projectId })]);
    }
    if (languageId) {
      createLE.match([node('language', 'Language', { id: languageId })]);
    }
    createLE.create([
      [
        node(
          'languageEngagement',
          ['LanguageEngagement', 'Engagement', 'BaseNode'],
          {
            createdAt,
            id,
          }
        ),
      ],
      ...property(
        'completeDate',
        input.completeDate || undefined,
        'languageEngagement'
      ),
      ...property(
        'disbursementCompleteDate',
        input.disbursementCompleteDate || undefined,
        'languageEngagement'
      ),
      ...property(
        'communicationsCompleteDate',
        input.communicationsCompleteDate || undefined,
        'languageEngagement'
      ),
      ...property(
        'startDateOverride',
        input.startDateOverride || undefined,
        'languageEngagement'
      ),
      ...property(
        'endDateOverride',
        input.endDateOverride || undefined,
        'languageEngagement'
      ),
      ...property('initialEndDate', undefined, 'languageEngagement'),
      ...property(
        'lukePartnership',
        input.lukePartnership || undefined,
        'languageEngagement'
      ),
      ...property(
        'firstScripture',
        input.firstScripture || undefined,
        'languageEngagement'
      ),
      ...property(
        'paratextRegistryId',
        input.paratextRegistryId || input.paraTextRegistryId || undefined,
        'languageEngagement'
      ),
      ...property('pnp', pnpId || undefined, 'languageEngagement'),
      ...property(
        'historicGoal',
        input.historicGoal || undefined,
        'languageEngagement'
      ),
      ...property('statusModifiedAt', undefined, 'languageEngagement'),
      ...property('lastSuspendedAt', undefined, 'languageEngagement'),
      ...property('lastReactivatedAt', undefined, 'languageEngagement'),
      ...property(
        'status',
        input.status || EngagementStatus.InDevelopment,
        'languageEngagement',
        'status',
        'EngagementStatus'
      ),
      ...property('modifiedAt', createdAt, 'languageEngagement'),
      ...property('canDelete', true, 'languageEngagement'),
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
          .match([node('project', 'Project', { id: projectId })])
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
          .match([node('language', 'Language', { id: languageId })])
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

    await this.files.createDefinedFile(
      pnpId,
      `PNP`,
      session,
      id,
      'pnp',
      input.pnp,
      'engagement.pnp'
    );
    if (input.pnp) {
      const pnpData = await this.pnpExtractor.extract(input.pnp, session);
      await this.savePnpData(id, pnpData);
    }

    const dbLanguageEngagement = new DbLanguageEngagement();
    await this.authorizationService.processNewBaseNode(
      dbLanguageEngagement,
      id,
      session.userId
    );

    const languageEngagement = (await this.readOne(
      id,
      session
    )) as LanguageEngagement;
    const event = new EngagementCreatedEvent(languageEngagement, session);
    await this.eventBus.publish(event);

    return event.engagement as LanguageEngagement;
  }

  async createInternshipEngagement(
    {
      projectId,
      internId,
      mentorId,
      countryOfOriginId,
      ...input
    }: CreateInternshipEngagement,
    session: Session
  ): Promise<InternshipEngagement> {
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
    // await this.verifyProjectStatus(projectId, session);

    if (input.status && input.status !== EngagementStatus.InDevelopment) {
      throw new InputException(
        'The Engagement status should be in development',
        'engagement.status'
      );
    }

    this.logger.debug('Mutation create internship engagement ', {
      input,
      projectId,
      mentorId,
      countryOfOriginId,
      userId: session.userId,
    });
    const id = await generateId();
    const createdAt = DateTime.local();
    const growthPlanId = await generateId();

    const createIE = this.db.query().match(matchSession(session));
    if (projectId) {
      createIE.match([node('project', 'Project', { id: projectId })]);
    }
    if (internId) {
      createIE.match([node('intern', 'User', { id: internId })]);
    }
    if (mentorId) {
      createIE.match([node('mentor', 'User', { id: mentorId })]);
    }
    if (countryOfOriginId) {
      createIE.match([
        node('countryOfOrigin', 'Location', {
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
            createdAt,
            id,
          }
        ),
      ],
      ...property('modifiedAt', createdAt, 'internshipEngagement'),
      ...property(
        'completeDate',
        input.completeDate || undefined,
        'internshipEngagement'
      ),
      ...property(
        'disbursementCompleteDate',
        input.disbursementCompleteDate || undefined,
        'internshipEngagement'
      ),
      ...property(
        'communicationsCompleteDate',
        input.communicationsCompleteDate || undefined,
        'internshipEngagement'
      ),
      ...property(
        'startDateOverride',
        input.startDateOverride || undefined,
        'internshipEngagement'
      ),
      ...property(
        'endDateOverride',
        input.endDateOverride || undefined,
        'internshipEngagement'
      ),
      ...property('initialEndDate', undefined, 'internshipEngagement'),
      ...property(
        'methodologies',
        input.methodologies || undefined,
        'internshipEngagement',
        'methodologies',
        'ProductMethodology'
      ),
      ...property(
        'position',
        input.position || undefined,
        'internshipEngagement',
        'position',
        'InternPosition'
      ),
      ...property(
        'growthPlan',
        growthPlanId || undefined,
        'internshipEngagement'
      ),
      ...property('statusModifiedAt', undefined, 'internshipEngagement'),
      ...property('lastSuspendedAt', undefined, 'internshipEngagement'),
      ...property('lastReactivatedAt', undefined, 'internshipEngagement'),
      ...property(
        'status',
        input.status || EngagementStatus.InDevelopment,
        'internshipEngagement'
      ),
      ...property('canDelete', true, 'internshipEngagement'),
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
          .match([node('intern', 'User', { id: internId })])
          .return('intern.id')
          .first())
      ) {
        throw new InputException('internId is invalid', 'engagement.internId');
      }
      if (
        mentorId &&
        !(await this.db
          .query()
          .match([node('mentor', 'User', { id: mentorId })])
          .return('mentor.id')
          .first())
      ) {
        throw new InputException('mentorId is invalid', 'engagement.mentorId');
      }
      if (
        projectId &&
        !(await this.db
          .query()
          .match([node('project', 'Project', { id: projectId })])
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
            node('country', 'Location', {
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

    await this.files.createDefinedFile(
      growthPlanId,
      `Growth Plan`,
      session,
      id,
      'growthPlan',
      input.growthPlan,
      'engagement.growthPlan'
    );

    const dbInternshipEngagement = new DbInternshipEngagement();
    await this.authorizationService.processNewBaseNode(
      dbInternshipEngagement,
      id,
      session.userId
    );

    const internshipEngagement = (await this.readOne(
      id,
      session
    )) as InternshipEngagement;
    const engagementCreatedEvent = new EngagementCreatedEvent(
      internshipEngagement,
      session
    );
    await this.eventBus.publish(engagementCreatedEvent);

    return engagementCreatedEvent.engagement as InternshipEngagement;
  }

  // READ ///////////////////////////////////////////////////////////

  async readOne(
    id: string,
    session: Session
  ): Promise<LanguageEngagement | InternshipEngagement> {
    this.logger.debug('readOne', { id, userId: session.userId });

    if (!id) {
      throw new NotFoundException('no id given', 'engagement.id');
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'Engagement', { id })])
      .call(matchPermList)
      .call(matchPropList, 'permList')
      .with([
        'propList',
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
      .optionalMatch([
        node('node'),
        relation('out', '', 'pnpData', { active: true }),
        node('pnpData'),
      ])
      .return([
        'propList, permList, node, project.id as projectId',
        '__typename, ceremony.id as ceremonyId',
        'language.id as languageId',
        'intern.id as internId',
        'countryOfOrigin.id as countryOfOriginId',
        'mentor.id as mentorId',
        'pnpData',
      ])
      .asResult<
        StandardReadResult<
          Except<
            DbPropsOfDto<LanguageEngagement & InternshipEngagement>,
            'pnpData'
          >
        > & {
          __typename: string;
          languageId: string;
          ceremonyId: string;
          projectId: string;
          internId: string;
          countryOfOriginId: string;
          mentorId: string;
          pnpData?: Node<PnpData>;
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
      pnpData: result.pnpData?.properties,
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  // UPDATE ////////////////////////////////////////////////////////

  async updateLanguageEngagement(
    input: UpdateLanguageEngagement,
    session: Session
  ): Promise<LanguageEngagement> {
    if (input.firstScripture) {
      await this.verifyFirstScripture({ engagementId: input.id });
    }

    // if (input.status) {
    //   await this.engagementRules.verifyStatusChange(
    //     input.id,
    //     session,
    //     input.status
    //   );
    // }

    const { pnp, paratextRegistryId, paraTextRegistryId, ...rest } = input;
    const changes = pickBy(
      {
        ...rest,
        paratextRegistryId: paratextRegistryId || paraTextRegistryId,
        modifiedAt: DateTime.local(),
      },
      (val) => val !== undefined
    );
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
    if (pnp) {
      const pnpData = await this.pnpExtractor.extract(pnp, session);
      await this.savePnpData(object.id, pnpData);
    }

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
          'paratextRegistryId',
          'historicGoal',
          'modifiedAt',
          'status',
          'initialEndDate',
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

    const updated = (await this.readOne(
      input.id,
      session
    )) as LanguageEngagement;
    const engagementUpdatedEvent = new EngagementUpdatedEvent(
      updated,
      object,
      input,
      session
    );
    await this.eventBus.publish(engagementUpdatedEvent);

    return engagementUpdatedEvent.updated as LanguageEngagement;
  }

  async updateInternshipEngagement(
    {
      growthPlan,
      mentorId,
      countryOfOriginId,
      ...input
    }: UpdateInternshipEngagement,
    session: Session
  ): Promise<InternshipEngagement> {
    const createdAt = DateTime.local();
    // if (input.status) {
    //   await this.engagementRules.verifyStatusChange(
    //     input.id,
    //     session,
    //     input.status
    //   );
    // }

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
          .match([node('newMentorUser', 'User', { id: mentorId })])
          .match([
            node('internshipEngagement', 'InternshipEngagement', {
              id: input.id,
            }),
          ])
          .optionalMatch([
            node('internshipEngagement'),
            relation('out', 'rel', 'mentor', { active: true }),
            node('oldMentorUser', 'User'),
          ])
          .set({
            values: {
              rel: {
                active: false,
              },
            },
          })
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
            node('newCountry', 'Location', {
              id: countryOfOriginId,
            }),
          ])
          .match([
            node('internshipEngagement', 'InternshipEngagement', {
              id: input.id,
            }),
          ])
          .optionalMatch([
            node('internshipEngagement'),
            relation('out', 'rel', 'countryOfOrigin', { active: true }),
            node('oldCountry', 'Location'),
          ])
          .set({
            values: {
              rel: {
                active: false,
              },
            },
          })
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
          'initialEndDate',
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
        'Could not update InternshipEngagement',
        exception
      );
    }

    const updated = (await this.readOne(
      input.id,
      session
    )) as InternshipEngagement;
    const engagementUpdatedEvent = new EngagementUpdatedEvent(
      updated,
      object,
      input,
      session
    );
    await this.eventBus.publish(engagementUpdatedEvent);

    return engagementUpdatedEvent.updated as InternshipEngagement;
  }

  // DELETE /////////////////////////////////////////////////////////

  async delete(id: string, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find engagement', 'engagement.id');
    }

    const canDelete = await this.db.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Engagement'
      );

    const result = await this.db
      .query()
      .match([
        node('engagement', 'Engagement', { id }),
        relation('in', '', 'engagement'),
        node('project', 'Project'),
      ])
      .return('project.id as projectId')
      .asResult<{ projectId: string }>()
      .first();

    if (result) {
      // await this.verifyProjectStatus(result.projectId, session);
    }

    const baseNodeLabels = ['BaseNode', 'Engagement', object.__typename];

    try {
      await this.db.deleteNodeNew({
        object,
        baseNodeLabels,
      });
    } catch (e) {
      this.logger.warning('Failed to delete Engagement', {
        exception: e,
      });
      throw new ServerException('Failed to delete Engagement');
    }

    await this.eventBus.publish(new EngagementDeletedEvent(object, session));
  }

  // LIST ///////////////////////////////////////////////////////////

  async list(
    { filter, ...input }: EngagementListInput,
    session: Session
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
                id: filter.projectId,
              }),
            ]
          : []),
      ])
      .call(
        calculateTotalAndPaginateList,
        input,
        this.securedProperties,
        defaultSorter
      );

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  async listProducts(
    engagement: LanguageEngagement,
    input: ProductListInput,
    session: Session
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
          relation('in', 'memberOfReadSecurityGroup', 'member'),
          node('readSecurityGroup', 'SecurityGroup'),
          relation('out', 'sgReadPerms', 'permission'),
          node('canRead', 'Permission', {
            property: 'product',
            read: true,
          }),
          relation('out', 'readPermsOfBaseNode', 'baseNode'),
          node('eng', 'Engagement', { id: engagement.id }),
        ],
      ])
      .match([
        [
          node('requestingUser'),
          relation('in', 'memberOfEditSecurityGroup', 'member'),
          node('editSecurityGroup', 'SecurityGroup'),
          relation('out', 'sgEditPerms', 'permission'),
          node('canEdit', 'Permission', {
            property: 'product',
            edit: true,
          }),
          relation('out', 'editPermsOfBaseNode', 'baseNode'),
          node('eng'),
        ],
      ])
      .return({
        canRead: [{ read: 'canRead' }],
        canEdit: [{ edit: 'canEdit' }],
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
    session: Session
  ): Promise<boolean> {
    const nodes = await this.db
      .query()
      .match([node('eng', baseNode)])
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
    session: Session
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
    session: Session
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

  private async savePnpData(id: string, pnpData: PnpData | null) {
    const query = this.db.query();
    pnpData
      ? query
          .match(node('node', 'LanguageEngagement', { id }))
          .merge([
            node('node'),
            relation('out', 'engPnp', 'pnpData', { active: true }),
            node('pnp', 'PnpData', pnpData),
          ])
      : query
          .match([
            node('node', 'LanguageEngagement', { id }),
            relation('out', 'engPnp', 'pnpData', { active: true }),
            node('pnp', 'PnpData'),
          ])
          .detachDelete('pnp');
    await query.run();
  }

  protected async getProjectTypeById(
    projectId: string
  ): Promise<ProjectType | undefined> {
    const qr = `
    MATCH (p:Project {id: $projectId}) RETURN p.type as type
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
      .match([node('intern', 'User', { id: internId })])
      .match([node('project', 'Project', { id: projectId })])
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
      .match([node('language', 'Language', { id: languageId })])
      .match([node('project', 'Project', { id: projectId })])
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

  /**
   * if firstScripture is true, validate that the engagement
   * is the only engagement for the language that has firstScripture=true
   * that the language doesn't have hasExternalFirstScripture=true
   */
  protected async verifyFirstScripture({
    engagementId,
    languageId,
  }: MergeExclusive<{ engagementId: string }, { languageId: string }>) {
    const startQuery = () =>
      this.db.query().call((query) =>
        engagementId
          ? query.match([
              node('languageEngagement', 'LanguageEngagement', {
                id: engagementId,
              }),
              relation('out', '', 'language', { active: true }),
              node('language', 'Language'),
            ])
          : query.match([node('language', 'Language', { id: languageId })])
      );

    await this.verifyFirstScriptureWithLanguage(startQuery());
    await this.verifyFirstScriptureWithEngagement(startQuery());
  }

  protected async verifyFirstScriptureWithLanguage(query: Query) {
    const languageResult = await query
      .match([
        node('language', 'Language'),
        relation('out', '', 'hasExternalFirstScripture', { active: true }),
        node('hasExternalFirstScripture', 'Property'),
      ])
      .where({
        hasExternalFirstScripture: {
          value: true,
        },
      })
      .return('language')
      .first();

    if (languageResult) {
      throw new InputException(
        'firstScripture can not be set to true if the language has hasExternalFirstScripture=true',
        'languageEngagement.firstScripture'
      );
    }
  }

  protected async verifyFirstScriptureWithEngagement(query: Query) {
    const engagementResult = await query
      .match([
        node('language', 'Language'),
        relation('in', '', 'language', { active: true }),
        node('otherLanguageEngagements', 'LanguageEngagement'),
        relation('out', '', 'firstScripture', { active: true }),
        node('firstScripture', 'Property'),
      ])
      .where({
        firstScripture: {
          value: true,
        },
      })
      .return('otherLanguageEngagements')
      .first();

    if (engagementResult) {
      throw new InputException(
        'firstScripture can not be set to true if it is not the only engagement for the language that has firstScripture=true',
        'languageEngagement.firstScripture'
      );
    }
  }

  /**
   * [BUSINESS RULE] Only Projects with a Status of 'In Development' can have Engagements created or deleted.
   */
  protected async verifyProjectStatus(projectId: string, session: Session) {
    let project;
    try {
      project = await this.projectService.readOne(projectId, session);
    } catch (e) {
      throw new InputException('projectId is invalid', 'engagement.projectId');
    }
    if (project.status !== ProjectStatus.InDevelopment) {
      throw new InputException(
        'The Project status is not in development',
        'project.status'
      );
    }
  }
}
