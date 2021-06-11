import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { node, Query, relation } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import { MergeExclusive } from 'type-fest';
import {
  DuplicateException,
  ID,
  InputException,
  NotFoundException,
  SecuredList,
  SecuredResource,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { ConfigService, IEventBus, ILogger, Logger } from '../../core';
import { runListQuery } from '../../core/database/results';
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
  UpdateInternshipEngagement,
  UpdateLanguageEngagement,
} from './dto';
import { EngagementRepository } from './engagement.repository';
import { EngagementRules } from './engagement.rules';
import {
  EngagementCreatedEvent,
  EngagementUpdatedEvent,
  EngagementWillDeleteEvent,
} from './events';

@Injectable()
export class EngagementService {
  constructor(
    private readonly repo: EngagementRepository,
    private readonly ceremonyService: CeremonyService,
    private readonly products: ProductService,
    private readonly config: ConfigService,
    private readonly files: FileService,
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
    input: CreateLanguageEngagement,
    session: Session
  ): Promise<LanguageEngagement> {
    const { languageId, projectId } = input;
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

    this.logger.debug('Creating language engagement', {
      input,
      userId: session.userId,
    });

    const { id, pnpId } = await this.repo.createLanguageEngagement(input);

    await this.files.createDefinedFile(
      pnpId,
      `PNP`,
      session,
      id,
      'pnp',
      input.pnp,
      'engagement.pnp'
    );

    await this.authorizationService.processNewBaseNode(
      LanguageEngagement,
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
    input: CreateInternshipEngagement,
    session: Session
  ): Promise<InternshipEngagement> {
    const { projectId, internId, mentorId, countryOfOriginId } = input;
    await this.verifyRelationshipEligibility(
      projectId,
      internId,
      ProjectType.Internship
    );

    await this.verifyProjectStatus(projectId, session);

    this.verifyCreationStatus(input.status);

    this.logger.debug('Creating internship engagement', {
      input,
      userId: session.userId,
    });

    let id;
    let growthPlanId;
    try {
      ({ id, growthPlanId } = await this.repo.createInternshipEngagement(
        input
      ));
    } catch (e) {
      if (!(e instanceof NotFoundException)) {
        throw e;
      }
      if (mentorId && !(await this.repo.findNode('mentor', mentorId))) {
        throw new NotFoundException(
          'Could not find mentor',
          'engagement.mentorId'
        );
      }
      if (
        countryOfOriginId &&
        !(await this.repo.findNode('countryOfOrigin', countryOfOriginId))
      ) {
        throw new NotFoundException(
          'Could not find country of origin',
          'engagement.countryOfOriginId'
        );
      }
      throw new ServerException('Could not create Internship Engagement', e);
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

    await this.authorizationService.processNewBaseNode(
      InternshipEngagement,
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

    const result = await query.first();

    if (!result) {
      throw new NotFoundException('could not find Engagement', 'engagement.id');
    }

    const props = {
      __typename: result.__typename,
      ...result.props,
      language: result.language,
      ceremony: result.ceremony,
      intern: result.intern,
      countryOfOrigin: result.countryOfOrigin,
      mentor: result.mentor,
    };

    const isLanguageEngagement = props.__typename === 'LanguageEngagement';

    const {
      startDate: _, // both of these are composed manually below, so exclude them
      endDate: __,
      ...securedProperties
    } = await this.authorizationService.secureProperties(
      isLanguageEngagement ? LanguageEngagement : InternshipEngagement,
      props,
      session,
      result.scopedRoles
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
      ...result.props,
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
        ...common,
        ...secured,
      };
    } else {
      // help TS understand that the secured props are for a InternshipEngagement
      const secured = securedProperties as SecuredResource<
        typeof InternshipEngagement,
        false
      >;
      return {
        ...common,
        ...secured,
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

    const changes = this.repo.getActualLanguageChanges(object, input);
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

    try {
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

    const changes = this.repo.getActualInternshipChanges(object, input);
    await this.authorizationService.verifyCanEditChanges(
      InternshipEngagement,
      object,
      changes,
      'engagement'
    );

    const { mentorId, countryOfOriginId, growthPlan, ...simpleChanges } =
      changes;

    await this.files.updateDefinedFile(
      object.growthPlan,
      'engagement.growthPlan',
      growthPlan,
      session
    );

    try {
      if (mentorId) {
        const mentorQ = this.repo.mentorQ(mentorId, session, input, createdAt);

        await mentorQ.first();
      }

      if (countryOfOriginId) {
        const countryQ = this.repo.countryQ(
          countryOfOriginId,
          input,
          createdAt
        );

        await countryQ.first();
      }

      await this.repo.updateInternshipProperties(object, simpleChanges);

      // update property node labels
      Object.keys(input).map(async (ele) => {
        if (ele === 'position') {
          await this.repo.addLabelsToNodes('position', input);
        }
        if (ele === 'methodologies') {
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

    const result = await this.repo.findNodeToDelete(id);

    if (result) {
      await this.verifyProjectStatus(result.projectId, session);
    }

    await this.eventBus.publish(new EngagementWillDeleteEvent(object, session));

    try {
      await this.repo.deleteNode(object);
    } catch (e) {
      this.logger.warning('Failed to delete Engagement', {
        exception: e,
      });
      throw new ServerException('Failed to delete Engagement');
    }
  }

  // LIST ///////////////////////////////////////////////////////////

  async list(
    { filter, ...input }: EngagementListInput,
    session: Session
  ): Promise<EngagementListOutput> {
    const query = this.repo.list(session, { filter, ...input });

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

  async listEngagementsWithDateRange() {
    const result = await this.repo.listEngagementsWithDateRange();

    return result;
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
      throw e instanceof NotFoundException
        ? e.withField('engagement.projectId')
        : e;
    }
    if (project.status !== ProjectStatus.InDevelopment) {
      throw new InputException(
        'The Project status is not in development',
        'project.status'
      );
    }
  }
}
