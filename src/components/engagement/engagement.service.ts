import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { MergeExclusive } from 'type-fest';
import {
  DuplicateException,
  generateId,
  ID,
  InputException,
  NotFoundException,
  SecuredList,
  SecuredResource,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import {
  ConfigService,
  IEventBus,
  ILogger,
  Logger,
  property,
} from '../../core';
import {
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
} from '../../core/database/results';
import { rolesForScope } from '../authorization';
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
  IEngagement,
  InternshipEngagement,
  LanguageEngagement,
  PnpData,
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';
import { EngagementRepository } from './engagement.repository';
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
  constructor(
    // private readonly db: DatabaseService,
    private readonly repo: EngagementRepository,
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
    @Logger(`engagement:service`) private readonly logger: ILogger
  ) {}

  // CREATE /////////////////////////////////////////////////////////

  async createLanguageEngagement(
    { languageId, projectId, ...input }: CreateLanguageEngagement,
    session: Session
  ): Promise<LanguageEngagement> {
    await this.verifyRelationshipEligibility(
      projectId,
      languageId,
      ProjectType.Translation
    );

    if (input.firstScripture) {
      await this.verifyFirstScripture({ languageId });
    }
    await this.verifyProjectStatus(projectId, session);

    this.verifyCreationStatus(input.status);

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

    const createLE = this.repo.query();
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
        input.paratextRegistryId,
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
        // !(await this.db
        //   .query()
        //   .match([node('project', 'Project', { id: projectId })])
        //   .return('project.id')
        //   .first())
        !(await this.repo.findNode('project', projectId))
      ) {
        throw new InputException(
          'projectId is invalid',
          'engagement.projectId'
        );
      }
      if (
        languageId &&
        // !(await this.db
        //   .query()
        //   .match([node('language', 'Language', { id: languageId })])
        //   .return('language.id')
        //   .first())
        !(await this.repo.findNode('language', languageId))
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
    await this.verifyRelationshipEligibility(
      projectId,
      internId,
      ProjectType.Internship
    );

    await this.verifyProjectStatus(projectId, session);

    this.verifyCreationStatus(input.status);

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

    const createIE = this.repo.query();
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
        // !(await this.db
        //   .query()
        //   .match([node('intern', 'User', { id: internId })])
        //   .return('intern.id')
        //   .first())
        !(await this.repo.findNode('intern', internId))
      ) {
        throw new InputException('internId is invalid', 'engagement.internId');
      }
      if (
        mentorId &&
        // !(await this.db
        //   .query()
        //   .match([node('mentor', 'User', { id: mentorId })])
        //   .return('mentor.id')
        //   .first())
        !(await this.repo.findNode('mentor', mentorId))
      ) {
        throw new InputException('mentorId is invalid', 'engagement.mentorId');
      }
      if (
        projectId &&
        // !(await this.db
        //   .query()
        //   .match([node('project', 'Project', { id: projectId })])
        //   .return('project.id')
        //   .first())
        !(await this.repo.findNode('project', projectId))
      ) {
        throw new InputException(
          'projectId is invalid',
          'engagement.projectId'
        );
      }
      if (
        countryOfOriginId &&
        // !(await this.db
        //   .query()
        //   .match([
        //     node('country', 'Location', {
        //       id: countryOfOriginId,
        //     }),
        //   ])
        //   .return('country.id')
        //   .first())
        !(await this.repo.findNode('countryOfOrigin', countryOfOriginId))
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

  private verifyCreationStatus(status?: EngagementStatus) {
    if (
      status &&
      status !== EngagementStatus.InDevelopment &&
      !this.config.migration
    ) {
      throw new InputException(
        'The Engagement status should be in development',
        'engagement.status'
      );
    }
  }

  // READ ///////////////////////////////////////////////////////////

  async readOne(
    id: ID,
    session: Session
  ): Promise<LanguageEngagement | InternshipEngagement> {
    this.logger.debug('readOne', { id, userId: session.userId });

    if (!id) {
      throw new NotFoundException('no id given', 'engagement.id');
    }
    const query = this.repo.readOne(id, session);
    // const query = this.db
    //   .query()
    //   .apply(matchRequestingUser(session))
    //   .match([node('node', 'Engagement', { id })])
    //   .apply(matchPropList)
    //   .optionalMatch([
    //     node('project'),
    //     relation('out', '', 'engagement', { active: true }),
    //     node('node'),
    //   ])
    //   .apply(matchMemberRoles(session.userId))
    //   .with([
    //     'propList',
    //     'node',
    //     'project',
    //     'memberRoles',
    //     `case
    //       when 'InternshipEngagement' IN labels(node)
    //       then 'InternshipEngagement'
    //       when 'LanguageEngagement' IN labels(node)
    //       then 'LanguageEngagement'
    //       end as __typename
    //       `,
    //   ])
    //   .optionalMatch([
    //     node('node'),
    //     relation('out', '', 'ceremony', { active: true }),
    //     node('ceremony'),
    //   ])
    //   .optionalMatch([
    //     node('node'),
    //     relation('out', '', 'language', { active: true }),
    //     node('language'),
    //   ])
    //   .optionalMatch([
    //     node('node'),
    //     relation('out', '', 'intern', { active: true }),
    //     node('intern'),
    //   ])
    //   .optionalMatch([
    //     node('node'),
    //     relation('out', '', 'countryOfOrigin', { active: true }),
    //     node('countryOfOrigin'),
    //   ])
    //   .optionalMatch([
    //     node('node'),
    //     relation('out', '', 'mentor', { active: true }),
    //     node('mentor'),
    //   ])
    //   .optionalMatch([
    //     node('node'),
    //     relation('out', '', 'pnpData', { active: true }),
    //     node('pnpData'),
    //   ])
    //   .return([
    //     'propList, node, project.id as project',
    //     '__typename, ceremony.id as ceremony',
    //     'language.id as language',
    //     'intern.id as intern',
    //     'countryOfOrigin.id as countryOfOrigin',
    //     'mentor.id as mentor',
    //     'pnpData',
    //     'memberRoles',
    //   ])
    //   .asResult<
    //     StandardReadResult<
    //       Omit<
    //         DbPropsOfDto<LanguageEngagement & InternshipEngagement>,
    //         | '__typename'
    //         | 'ceremony'
    //         | 'language'
    //         | 'pnpData'
    //         | 'countryOfOrigin'
    //         | 'intern'
    //         | 'mentor'
    //       >
    //     > & {
    //       __typename: 'LanguageEngagement' | 'InternshipEngagement';
    //       language: ID;
    //       ceremony: ID;
    //       project: ID;
    //       intern: ID;
    //       countryOfOrigin: ID;
    //       mentor: ID;
    //       pnpData?: Node<PnpData>;
    //       memberRoles: Role[][];
    //     }
    //   >();

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('could not find Engagement', 'engagement.id');
    }

    const props = {
      __typename: result.__typename,
      ...parsePropList(result.propList),
      language: result.language,
      ceremony: result.ceremony,
      intern: result.intern,
      countryOfOrigin: result.countryOfOrigin,
      mentor: result.mentor,
    };

    const isLanguageEngagement = props.__typename === 'LanguageEngagement';

    const securedProperties = await this.authorizationService.secureProperties(
      isLanguageEngagement ? LanguageEngagement : InternshipEngagement,
      props,
      session,
      result.memberRoles.flat().map(rolesForScope('project'))
    );

    const project = await this.projectService.readOne(result.project, session);

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

    const common = {
      __typename: result.__typename,
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
      canDelete:
        props.status !== EngagementStatus.InDevelopment &&
        !session.roles.includes(`global:Administrator`)
          ? false
          : await this.repo.checkDeletePermission(id, session),
    };

    if (isLanguageEngagement) {
      // help TS understand that the secured props are for a LanguageEngagement
      const secured = securedProperties as SecuredResource<
        typeof LanguageEngagement,
        false
      >;
      return {
        ...secured,
        ...common,
        pnpData: result.pnpData?.properties,
      };
    } else {
      // help TS understand that the secured props are for a InternshipEngagement
      const secured = securedProperties as SecuredResource<
        typeof InternshipEngagement,
        false
      >;
      return {
        ...secured,
        ...common,
        methodologies: {
          ...secured.methodologies,
          value: secured.methodologies.value ?? [],
        },
      };
    }
  }

  // UPDATE ////////////////////////////////////////////////////////

  async updateLanguageEngagement(
    input: UpdateLanguageEngagement,
    session: Session
  ): Promise<LanguageEngagement> {
    if (input.firstScripture) {
      await this.verifyFirstScripture({ engagementId: input.id });
    }

    if (input.status) {
      await this.engagementRules.verifyStatusChange(
        input.id,
        session,
        input.status
      );
    }

    const object = (await this.readOne(
      input.id,
      session
    )) as LanguageEngagement;

    // const changes = this.db.getActualChanges(LanguageEngagement, object, input);
    const changes = this.repo.getActualLanguageChanges(
      // 'language',
      object,
      input
    );
    await this.authorizationService.verifyCanEditChanges(
      LanguageEngagement,
      object,
      changes
    );

    const { pnp, ...simpleChanges } = changes;

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
      // await this.db.updateProperties({
      //   type: LanguageEngagement,
      //   object: object,
      //   changes: simpleChanges,
      // });
      await this.repo.updateLanguageProperties(object, simpleChanges);
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
    input: UpdateInternshipEngagement,
    session: Session
  ): Promise<InternshipEngagement> {
    const createdAt = DateTime.local();
    if (input.status) {
      await this.engagementRules.verifyStatusChange(
        input.id,
        session,
        input.status
      );
    }

    const object = (await this.readOne(
      input.id,
      session
    )) as InternshipEngagement;

    // const changes = this.db.getActualChanges(
    //   InternshipEngagement,
    //   object,
    //   input
    // );
    const changes = this.repo.getActualInternshipChanges(object, input);
    await this.authorizationService.verifyCanEditChanges(
      InternshipEngagement,
      object,
      changes,
      'engagement'
    );

    const {
      mentorId,
      countryOfOriginId,
      growthPlan,
      ...simpleChanges
    } = changes;

    await this.files.updateDefinedFile(
      object.growthPlan,
      'engagement.growthPlan',
      growthPlan,
      session
    );

    try {
      if (mentorId) {
        const mentorQ = this.repo.mentorQ(mentorId, session, input, createdAt);
        // const mentorQ = this.db
        //   .query()
        //   .match(matchSession(session))
        //   .match([node('newMentorUser', 'User', { id: mentorId })])
        //   .match([
        //     node('internshipEngagement', 'InternshipEngagement', {
        //       id: input.id,
        //     }),
        //   ])
        //   .optionalMatch([
        //     node('internshipEngagement'),
        //     relation('out', 'rel', 'mentor', { active: true }),
        //     node('oldMentorUser', 'User'),
        //   ])
        //   .set({
        //     values: {
        //       rel: {
        //         active: false,
        //       },
        //     },
        //   })
        //   .create([
        //     node('internshipEngagement'),
        //     relation('out', '', 'mentor', {
        //       active: true,
        //       createdAt,
        //     }),
        //     node('newMentorUser'),
        //   ])
        //   .return('internshipEngagement.id as id');
        await mentorQ.first();
      }

      if (countryOfOriginId) {
        const countryQ = this.repo.countryQ(
          countryOfOriginId,
          input,
          createdAt
        );
        // const countryQ = this.db
        //   .query()
        //   .match([
        //     node('newCountry', 'Location', {
        //       id: countryOfOriginId,
        //     }),
        //   ])
        //   .match([
        //     node('internshipEngagement', 'InternshipEngagement', {
        //       id: input.id,
        //     }),
        //   ])
        //   .optionalMatch([
        //     node('internshipEngagement'),
        //     relation('out', 'rel', 'countryOfOrigin', { active: true }),
        //     node('oldCountry', 'Location'),
        //   ])
        //   .set({
        //     values: {
        //       rel: {
        //         active: false,
        //       },
        //     },
        //   })
        //   .create([
        //     node('internshipEngagement'),
        //     relation('out', '', 'countryOfOrigin', {
        //       active: true,
        //       createdAt,
        //     }),
        //     node('newCountry'),
        //   ])
        //   .return('internshipEngagement.id as id');

        await countryQ.first();
      }

      // await this.db.updateProperties({
      //   type: InternshipEngagement,
      //   object,
      //   changes: simpleChanges,
      // });

      await this.repo.updateInternshipProperties(object, simpleChanges);

      // update property node labels
      Object.keys(input).map(async (ele) => {
        if (ele === 'position') {
          // await this.db.addLabelsToPropNodes(input.id, 'position', [
          //   'InternPosition',
          // ]);
          await this.repo.addLabelsToNodes('position', input);
        }
        if (ele === 'methodologies') {
          // await this.db.addLabelsToPropNodes(input.id, 'methodologies', [
          //   'ProductMethodology',
          // ]);
          await this.repo.addLabelsToNodes('methodologies', input);
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

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find engagement', 'engagement.id');
    }

    if (!object.canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Engagement'
      );

    // const result = await this.db
    //   .query()
    //   .match([
    //     node('engagement', 'Engagement', { id }),
    //     relation('in', '', 'engagement'),
    //     node('project', 'Project'),
    //   ])
    //   .return('project.id as projectId')
    //   .asResult<{ projectId: ID }>()
    //   .first();
    const result = await this.repo.findNodeToDelete(id);

    if (result) {
      await this.verifyProjectStatus(result.projectId, session);
    }

    try {
      await this.repo.deleteNode(object);
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

    const query = this.repo.list(session, { filter, ...input });
    // const query = this.db
    //   .query()
    //   .match([
    //     requestingUser(session),
    //     ...permissionsOfNode(label),
    //     ...(filter.projectId
    //       ? [
    //           relation('in', '', 'engagement', { active: true }),
    //           node('project', 'Project', {
    //             id: filter.projectId,
    //           }),
    //         ]
    //       : []),
    //   ])
    //   .apply(calculateTotalAndPaginateList(IEngagement, input));

    const engagements = await runListQuery(query, input, (id) =>
      this.readOne(id, session)
    );
    return engagements;
  }

  async listAllByProjectId(
    // projectId: string,
    projectId: ID,
    session: Session
  ): Promise<IEngagement[]> {
    const engagementIds = await this.repo.listAllByProjectId(projectId);
    // const engagementIds = await this.db
    //   .query()
    //   .match([
    //     node('project', 'Project', { id: projectId }),
    //     relation('out', '', 'engagement', { active: true }),
    //     node('engagement', 'Engagement'),
    //   ])
    //   .return('engagement.id as id')
    //   .asResult<{ id: ID }>()
    //   .run();

    const engagements = await Promise.all(
      engagementIds.map((e) => this.readOne(e.id, session))
    );
    return engagements;
  }

  async listProducts(
    engagement: LanguageEngagement,
    input: ProductListInput,
    session: Session
  ): Promise<SecuredProductList> {
    const { product: perms } = await this.authorizationService.getPermissions(
      LanguageEngagement,
      session,
      await this.repo.rolesInScope(engagement.id, session)
    );
    if (!perms.canRead) {
      return SecuredList.Redacted;
    }

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
      canRead: true,
      canCreate: perms.canEdit,
    };
  }

  async hasOngoing(projectId: ID) {
    const ids = await this.repo.getOngoingEngagementIds(projectId);
    return ids.length > 0;
  }

  // CONSISTENCY ////////////////////////////////////////////////////

  async checkEngagementConsistency(
    baseNode: string,
    session: Session
  ): Promise<boolean> {
    const nodes = await this.repo.checkEngagementConsistency(baseNode);
    // const nodes = await this.db
    //   .query()
    //   .match([node('eng', baseNode)])
    //   .return('eng.id as id')
    //   .run();
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
                // this.db.isRelationshipUnique({
                //   session,
                //   id: ie.id,
                //   relName: rel,
                //   srcNodeLabel: 'LanguageEngagement',
                // })
                this.repo.isRelationshipUnique('language', session, ie, rel)
              )
              .every((n) => n)
          )
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          nodes.map(
            async (ie: { id: any }) =>
              // await this.db.hasProperties({
              //   session,
              //   id: ie.id,
              //   props: requiredProperties,
              //   nodevar: 'LanguageEngagement',
              // })
              await this.repo.hasProperties(
                'language',
                session,
                ie,
                requiredProperties
              )
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
                // this.db.isRelationshipUnique({
                //   session,
                //   id: ie.id,
                //   relName: rel,
                //   srcNodeLabel: 'InternshipEngagement',
                // })
                this.repo.isRelationshipUnique('intern', session, ie, rel)
              )
              .every((n) => n)
          )
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          nodes.map(
            async (ie: { id: any }) =>
              // await this.db.hasProperties({
              //   session,
              //   id: ie.id,
              //   props: requiredProperties,
              //   nodevar: 'InternshipEngagement',
              // })
              await this.repo.hasProperties(
                'intern',
                session,
                ie,
                requiredProperties
              )
          )
        )
      ).every((n) => n)
    );
  }

  async listEngagementsWithDateRange() {
    const result = await this.repo.listEngagementsWithDateRange();
    // const result = await this.db
    //   .query()
    //   .match(node('engagement', 'Engagement'))
    //   .match([
    //     node('project', 'Project'),
    //     relation('out', '', 'engagement', { active: true }),
    //     node('engagement'),
    //   ])
    //   .optionalMatch([
    //     node('project'),
    //     relation('out', '', 'mouStart', { active: true }),
    //     node('mouStart', 'Property'),
    //   ])
    //   .optionalMatch([
    //     node('project'),
    //     relation('out', '', 'mouEnd', { active: true }),
    //     node('mouEnd', 'Property'),
    //   ])
    //   .optionalMatch([
    //     node('engagement'),
    //     relation('out', '', 'startDateOverride', { active: true }),
    //     node('startDateOverride', 'Property'),
    //   ])
    //   .optionalMatch([
    //     node('engagement'),
    //     relation('out', '', 'endDateOverride', { active: true }),
    //     node('endDateOverride', 'Property'),
    //   ])
    //   .with([
    //     'engagement',
    //     'mouStart',
    //     'mouEnd',
    //     'startDateOverride',
    //     'endDateOverride',
    //   ])
    //   .raw(
    //     'WHERE (mouStart.value IS NOT NULL AND mouEnd.value IS NOT NULL) OR (startDateOverride.value IS NOT NULL AND endDateOverride.value IS NOT NULL)'
    //   )
    //   .return([
    //     'engagement.id as engagementId',
    //     'mouStart.value as startDate',
    //     'mouEnd.value as endDate',
    //     'startDateOverride.value as startDateOverride',
    //     'endDateOverride.value as endDateOverride',
    //   ])
    //   .asResult<{
    //     engagementId: ID;
    //     startDate: CalendarDate;
    //     endDate: CalendarDate;
    //     startDateOverride: CalendarDate;
    //     endDateOverride: CalendarDate;
    //   }>()
    //   .run();

    return result;
  }

  private async savePnpData(id: ID, pnpData: PnpData | null) {
    const query = this.repo.query();
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

  protected async verifyRelationshipEligibility(
    projectId: ID,
    otherId: ID,
    type: ProjectType
  ): Promise<void> {
    const isTranslation = type === ProjectType.Translation;
    const property = isTranslation ? 'language' : 'intern';
    const result = await this.repo.verifyRelationshipEligibility(
      projectId,
      otherId,
      isTranslation,
      property
    );
    // const result = await this.db
    //   .query()
    //   .optionalMatch(node('project', 'Project', { id: projectId }))
    //   .optionalMatch(
    //     node('other', isTranslation ? 'Language' : 'User', {
    //       id: otherId,
    //     })
    //   )
    //   .optionalMatch([
    //     node('project'),
    //     relation('out', '', 'engagement', { active: true }),
    //     node('engagement'),
    //     relation('out', '', property, { active: true }),
    //     node('other'),
    //   ])
    //   .return(['project', 'other', 'engagement'])
    //   .asResult<{
    //     project?: Node<{ type: ProjectType }>;
    //     other?: Node;
    //     engagement?: Node;
    //   }>()
    //   .first();

    if (!result?.project) {
      throw new NotFoundException(
        'Could not find project',
        'engagement.projectId'
      );
    }

    if (result.project.properties.type !== type) {
      throw new InputException(
        `Only ${
          isTranslation ? 'Language' : 'Internship'
        } Engagements can be created on ${type} Projects`,
        `engagement.${property}Id`
      );
    }

    const label = isTranslation ? 'language' : 'person';
    if (!result?.other) {
      throw new NotFoundException(
        `Could not find ${label}`,
        `engagement.${property}Id`
      );
    }

    if (result.engagement) {
      throw new DuplicateException(
        `engagement.${property}Id`,
        `Engagement for this project and ${label} already exists`
      );
    }
  }

  /**
   * if firstScripture is true, validate that the engagement
   * is the only engagement for the language that has firstScripture=true
   * that the language doesn't have hasExternalFirstScripture=true
   */
  protected async verifyFirstScripture({
    engagementId,
    languageId,
  }: MergeExclusive<{ engagementId: ID }, { languageId: ID }>) {
    const startQuery = this.repo.startQuery(engagementId, languageId);
    // const startQuery = () =>
    //   this.db.query().apply((query) =>
    //     engagementId
    //       ? query.match([
    //           node('languageEngagement', 'LanguageEngagement', {
    //             id: engagementId,
    //           }),
    //           relation('out', '', 'language', { active: true }),
    //           node('language', 'Language'),
    //         ])
    //       : query.match([node('language', 'Language', { id: languageId })])
    //   );

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
  protected async verifyProjectStatus(projectId: ID, session: Session) {
    if (
      this.config.migration ||
      session.roles.includes('global:Administrator')
    ) {
      return;
    }

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
