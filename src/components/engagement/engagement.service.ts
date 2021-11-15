import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  InputException,
  NotFoundException,
  ObjectView,
  SecuredList,
  SecuredResource,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
  viewOfChangeset,
} from '../../common';
import {
  ConfigService,
  HandleIdLookup,
  IEventBus,
  ILogger,
  Logger,
} from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { CeremonyService } from '../ceremony';
import { FileService } from '../file';
import { Location } from '../location/dto';
import {
  ProductListInput,
  ProductService,
  SecuredProductList,
} from '../product';
import { ProjectStatus } from '../project';
import { ProjectType } from '../project/dto/type.enum';
import { ProjectService } from '../project/project.service';
import { User } from '../user/dto';
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
import {
  EngagementRepository,
  LanguageOrEngagementId,
} from './engagement.repository';
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
    session: Session,
    changeset?: ID
  ): Promise<LanguageEngagement> {
    const { languageId, projectId } = input;
    await this.verifyRelationshipEligibility(
      projectId,
      languageId,
      ProjectType.Translation,
      changeset
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

    const { id, pnpId } = await this.repo.createLanguageEngagement(
      input,
      changeset
    );

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
      session,
      viewOfChangeset(changeset)
    )) as LanguageEngagement;

    const event = new EngagementCreatedEvent(
      languageEngagement,
      input,
      session
    );
    await this.eventBus.publish(event);

    return event.engagement as LanguageEngagement;
  }

  async createInternshipEngagement(
    input: CreateInternshipEngagement,
    session: Session,
    changeset?: ID
  ): Promise<InternshipEngagement> {
    const { projectId, internId, mentorId, countryOfOriginId } = input;
    await this.verifyRelationshipEligibility(
      projectId,
      internId,
      ProjectType.Internship,
      changeset
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
        input,
        changeset
      ));
    } catch (e) {
      if (!(e instanceof NotFoundException)) {
        throw e;
      }
      if (mentorId && !(await this.repo.doesNodeExist(User, mentorId))) {
        throw new NotFoundException(
          'Could not find mentor',
          'engagement.mentorId'
        );
      }
      if (
        countryOfOriginId &&
        !(await this.repo.doesNodeExist(Location, countryOfOriginId))
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
      session,
      viewOfChangeset(changeset)
    )) as InternshipEngagement;
    if (changeset) {
      return internshipEngagement;
    }
    const engagementCreatedEvent = new EngagementCreatedEvent(
      internshipEngagement,
      input,
      session
    );
    await this.eventBus.publish(engagementCreatedEvent);

    return engagementCreatedEvent.engagement as InternshipEngagement;
  }

  private verifyCreationStatus(status?: EngagementStatus) {
    if (status && status !== EngagementStatus.InDevelopment) {
      throw new InputException(
        'The Engagement status should be in development',
        'engagement.status'
      );
    }
  }

  // READ ///////////////////////////////////////////////////////////

  @HandleIdLookup([LanguageEngagement, InternshipEngagement])
  async readOne(
    id: ID,
    session: Session,
    view?: ObjectView
  ): Promise<LanguageEngagement | InternshipEngagement> {
    this.logger.debug('readOne', { id, userId: session.userId });
    if (!id) {
      throw new NotFoundException('no id given', 'engagement.id');
    }
    const dto = await this.repo.readOne(id, session, view);
    return await this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session, view?: ObjectView) {
    const engagements = await this.repo.readMany(ids, session, view);
    return await Promise.all(
      engagements.map((dto) => this.secure(dto, session))
    );
  }

  async secure(
    dto: UnsecuredDto<Engagement>,
    session: Session
  ): Promise<Engagement> {
    const isLanguageEngagement = dto.__typename === 'LanguageEngagement';

    const securedProperties = await this.authorizationService.secureProperties(
      isLanguageEngagement ? LanguageEngagement : InternshipEngagement,
      dto,
      session
    );

    const canDelete =
      dto.status !== EngagementStatus.InDevelopment &&
      !session.roles.includes(`global:Administrator`)
        ? false
        : await this.repo.checkDeletePermission(dto.id, session);
    if (isLanguageEngagement) {
      // help TS understand that the secured props are for a LanguageEngagement
      const secured = securedProperties as SecuredResource<
        typeof LanguageEngagement,
        false
      >;

      return {
        ...(dto as UnsecuredDto<LanguageEngagement>),
        ...secured,
        canDelete,
      };
    } else {
      // help TS understand that the secured props are for a InternshipEngagement
      const secured = securedProperties as SecuredResource<
        typeof InternshipEngagement,
        false
      >;
      return {
        ...(dto as UnsecuredDto<InternshipEngagement>),
        ...secured,
        methodologies: {
          ...secured.methodologies,
          value: secured.methodologies.value ?? [],
        },
        canDelete,
      };
    }
  }

  // UPDATE ////////////////////////////////////////////////////////

  async updateLanguageEngagement(
    input: UpdateLanguageEngagement,
    session: Session,
    changeset?: ID
  ): Promise<LanguageEngagement> {
    const view: ObjectView = viewOfChangeset(changeset);
    if (input.firstScripture) {
      await this.verifyFirstScripture({ engagementId: input.id });
    }

    if (input.status) {
      await this.engagementRules.verifyStatusChange(
        input.id,
        session,
        input.status,
        changeset
      );
    }

    const object = (await this.readOne(
      input.id,
      session,
      view
    )) as LanguageEngagement;

    const { methodology: _, ...maybeChanges } = input;
    const changes = this.repo.getActualLanguageChanges(object, maybeChanges);
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
      await this.repo.updateLanguageProperties(
        object,
        simpleChanges,
        changeset
      );
    } catch (exception) {
      this.logger.error('Error updating language engagement', { exception });
      throw new ServerException(
        'Could not update LanguageEngagement',
        exception
      );
    }

    const updated = (await this.readOne(
      input.id,
      session,
      view
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
    session: Session,
    changeset?: ID
  ): Promise<InternshipEngagement> {
    const view: ObjectView = viewOfChangeset(changeset);
    if (input.status) {
      await this.engagementRules.verifyStatusChange(
        input.id,
        session,
        input.status,
        changeset
      );
    }

    const object = (await this.readOne(
      input.id,
      session,
      view
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
        await this.repo.updateMentor(input.id, mentorId);
      }

      if (countryOfOriginId) {
        await this.repo.updateCountryOfOrigin(input.id, countryOfOriginId);
      }

      await this.repo.updateInternshipProperties(
        object,
        simpleChanges,
        changeset
      );
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

    if (changeset) {
      return updated;
    }

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

  async delete(id: ID, session: Session, changeset?: ID): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find engagement', 'engagement.id');
    }

    if (!object.canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Engagement'
      );

    await this.verifyProjectStatus(object.project, session);

    await this.eventBus.publish(new EngagementWillDeleteEvent(object, session));

    try {
      await this.repo.deleteNode(object, changeset);
    } catch (e) {
      this.logger.warning('Failed to delete Engagement', {
        exception: e,
      });
      throw new ServerException('Failed to delete Engagement');
    }
  }

  // LIST ///////////////////////////////////////////////////////////

  async list(
    input: EngagementListInput,
    session: Session,
    view?: ObjectView
  ): Promise<EngagementListOutput> {
    const results = await this.repo.list(input, session, view?.changeset);

    return await mapListResults(results, (dto) => this.secure(dto, session));
  }

  async listAllByProjectId(projectId: ID, session: Session) {
    const engagements = await this.repo.listAllByProjectId(projectId, session);
    return await Promise.all(
      engagements.map((dto) => this.secure(dto, session))
    );
  }

  async listProducts(
    engagement: LanguageEngagement,
    input: ProductListInput,
    session: Session
  ): Promise<SecuredProductList> {
    const { product: perms } = await this.authorizationService.getPermissions({
      resource: LanguageEngagement,
      sessionOrUserId: session,
      dto: engagement,
    });
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

  protected async verifyRelationshipEligibility(
    projectId: ID,
    otherId: ID,
    type: ProjectType,
    changeset?: ID
  ): Promise<void> {
    const isTranslation = type === ProjectType.Translation;
    const property = isTranslation ? 'language' : 'intern';
    const result = await this.repo.verifyRelationshipEligibility(
      projectId,
      otherId,
      isTranslation,
      property,
      changeset
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
  protected async verifyFirstScripture(id: LanguageOrEngagementId) {
    if (await this.repo.doesLanguageHaveExternalFirstScripture(id)) {
      throw new InputException(
        'First scripture has already been marked as having been done externally',
        'languageEngagement.firstScripture'
      );
    }
    if (await this.repo.doOtherEngagementsHaveFirstScripture(id)) {
      throw new InputException(
        'Another engagement has already been marked as having done the first scripture',
        'languageEngagement.firstScripture'
      );
    }
  }

  /**
   * [BUSINESS RULE] Only Projects with a Status of 'In Development' can have Engagements created or deleted.
   */
  protected async verifyProjectStatus(projectId: ID, session: Session) {
    if (session.roles.includes('global:Administrator')) {
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
