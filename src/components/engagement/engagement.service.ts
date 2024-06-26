import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  InputException,
  NotFoundException,
  ObjectView,
  SecuredList,
  ServerException,
  Session,
  UnsecuredDto,
  viewOfChangeset,
} from '~/common';
import {
  ConfigService,
  HandleIdLookup,
  IEventBus,
  ILogger,
  Logger,
  ResourceLoader,
} from '~/core';
import { mapListResults } from '~/core/database/results';
import { Privileges } from '../authorization';
import { CeremonyService } from '../ceremony';
import { FileService } from '../file';
import { Location } from '../location/dto';
import { ProductService } from '../product';
import { ProductListInput, SecuredProductList } from '../product/dto';
import { ProjectService } from '../project';
import { IProject, ProjectType } from '../project/dto';
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
  resolveEngagementType,
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
    @Inject(forwardRef(() => ProductService))
    private readonly products: ProductService & {},
    private readonly config: ConfigService,
    private readonly files: FileService,
    private readonly engagementRules: EngagementRules,
    private readonly privileges: Privileges,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService & {},
    private readonly eventBus: IEventBus,
    private readonly resources: ResourceLoader,
    @Logger(`engagement:service`) private readonly logger: ILogger,
  ) {}

  async createLanguageEngagement(
    input: CreateLanguageEngagement,
    session: Session,
    changeset?: ID,
  ): Promise<LanguageEngagement> {
    const { languageId, projectId } = input;

    await this.verifyRelationshipEligibility(
      projectId,
      languageId,
      false,
      changeset,
    );

    await this.verifyCreateEngagement(projectId, session);

    if (input.firstScripture) {
      await this.verifyFirstScripture({ languageId });
    }

    this.verifyCreationStatus(input.status);

    this.logger.debug('Creating language engagement', {
      input,
      userId: session.userId,
    });

    const { id, pnpId } = await this.repo.createLanguageEngagement(
      input,
      changeset,
    );

    await this.files.createDefinedFile(
      pnpId,
      `PNP`,
      session,
      id,
      'pnp',
      input.pnp,
      'engagement.pnp',
    );

    const engagement = await this.repo.readOne(
      id,
      session,
      viewOfChangeset(changeset),
    );

    const event = new EngagementCreatedEvent(engagement, input, session);
    await this.eventBus.publish(event);

    return (await this.secure(event.engagement, session)) as LanguageEngagement;
  }

  async createInternshipEngagement(
    input: CreateInternshipEngagement,
    session: Session,
    changeset?: ID,
  ): Promise<InternshipEngagement> {
    const { projectId, internId, mentorId, countryOfOriginId } = input;

    await this.verifyRelationshipEligibility(
      projectId,
      internId,
      true,
      changeset,
    );

    await this.verifyCreateEngagement(projectId, session);

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
        changeset,
      ));
    } catch (e) {
      if (!(e instanceof NotFoundException)) {
        throw e;
      }
      if (mentorId && !(await this.repo.getBaseNode(mentorId, User))) {
        throw new NotFoundException(
          'Could not find mentor',
          'engagement.mentorId',
        );
      }
      if (
        countryOfOriginId &&
        !(await this.repo.getBaseNode(countryOfOriginId, Location))
      ) {
        throw new NotFoundException(
          'Could not find country of origin',
          'engagement.countryOfOriginId',
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
      'engagement.growthPlan',
    );

    const engagement = await this.repo.readOne(
      id,
      session,
      viewOfChangeset(changeset),
    );

    const event = new EngagementCreatedEvent(engagement, input, session);
    await this.eventBus.publish(event);

    return (await this.secure(
      event.engagement,
      session,
    )) as InternshipEngagement;
  }

  private async verifyCreateEngagement(projectId: ID, session: Session) {
    const project = await this.resources.load(IProject, projectId);
    const projectPrivileges = this.privileges.for(session, IProject, {
      ...project,
      project,
    } as any);

    projectPrivileges.verifyCan('create', 'engagement');
  }

  private verifyCreationStatus(status?: EngagementStatus) {
    if (status && status !== EngagementStatus.InDevelopment) {
      throw new InputException(
        'The Engagement status should be in development',
        'engagement.status',
      );
    }
  }

  // READ ///////////////////////////////////////////////////////////

  @HandleIdLookup([LanguageEngagement, InternshipEngagement])
  async readOne(
    id: ID,
    session: Session,
    view?: ObjectView,
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
      engagements.map((dto) => this.secure(dto, session)),
    );
  }

  async secure(
    dto: UnsecuredDto<Engagement>,
    session: Session,
  ): Promise<Engagement> {
    return this.privileges.for(session, resolveEngagementType(dto)).secure(dto);
  }

  // UPDATE ////////////////////////////////////////////////////////

  async updateLanguageEngagement(
    input: UpdateLanguageEngagement,
    session: Session,
    changeset?: ID,
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
        changeset,
      );
    }

    const previous = await this.repo.readOne(input.id, session, view);
    const object = (await this.secure(previous, session)) as LanguageEngagement;

    const { methodology: _, ...maybeChanges } = input;
    const changes = this.repo.getActualLanguageChanges(object, maybeChanges);
    this.privileges
      .for(session, LanguageEngagement, object)
      .verifyChanges(changes);

    await this.files.updateDefinedFile(
      object.pnp,
      'engagement.pnp',
      changes.pnp,
      session,
    );

    await this.repo.updateLanguage(object, changes, changeset);

    const updated = (await this.repo.readOne(
      input.id,
      session,
      view,
    )) as UnsecuredDto<LanguageEngagement>;

    const event = new EngagementUpdatedEvent(updated, previous, input, session);
    await this.eventBus.publish(event);

    return (await this.secure(event.updated, session)) as LanguageEngagement;
  }

  async updateInternshipEngagement(
    input: UpdateInternshipEngagement,
    session: Session,
    changeset?: ID,
  ): Promise<InternshipEngagement> {
    const view: ObjectView = viewOfChangeset(changeset);
    if (input.status) {
      await this.engagementRules.verifyStatusChange(
        input.id,
        session,
        input.status,
        changeset,
      );
    }

    const previous = await this.repo.readOne(input.id, session, view);
    const object = (await this.secure(
      previous,
      session,
    )) as InternshipEngagement;

    const changes = this.repo.getActualInternshipChanges(object, input);
    this.privileges
      .for(session, InternshipEngagement, object)
      .verifyChanges(changes, { pathPrefix: 'engagement' });

    await this.files.updateDefinedFile(
      object.growthPlan,
      'engagement.growthPlan',
      changes.growthPlan,
      session,
    );

    await this.repo.updateInternship(object, changes, changeset);

    const updated = (await this.repo.readOne(
      input.id,
      session,
      view,
    )) as UnsecuredDto<InternshipEngagement>;

    const event = new EngagementUpdatedEvent(updated, previous, input, session);
    await this.eventBus.publish(event);

    return (await this.secure(event.updated, session)) as InternshipEngagement;
  }

  async triggerUpdateEvent(id: ID, session: Session) {
    const object = await this.repo.readOne(id, session);
    const event = new EngagementUpdatedEvent(object, object, { id }, session);
    await this.eventBus.publish(event);
  }

  // DELETE /////////////////////////////////////////////////////////

  async delete(id: ID, session: Session, changeset?: ID): Promise<void> {
    const object = await this.readOne(id, session);

    this.privileges
      .for(session, resolveEngagementType(object), object)
      .verifyCan('delete');

    await this.eventBus.publish(new EngagementWillDeleteEvent(object, session));

    try {
      await this.repo.deleteNode(object, { changeset });
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
    view?: ObjectView,
  ): Promise<EngagementListOutput> {
    // -- don't have to check if canList because all roles can see at least on prop of it
    // if that ever changes, create a limitedScope and add to the list function.
    const results = await this.repo.list(input, session, view?.changeset);

    return await mapListResults(results, (dto) => this.secure(dto, session));
  }

  async listAllByProjectId(projectId: ID, session: Session) {
    return await this.repo.listAllByProjectId(projectId, session);
  }

  async listProducts(
    engagement: LanguageEngagement,
    input: ProductListInput,
    session: Session,
  ): Promise<SecuredProductList> {
    const privs = this.privileges
      .for(session, LanguageEngagement, engagement)
      .forEdge('product');

    if (!privs.can('read')) {
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
      session,
    );

    return {
      ...result,
      canRead: true,
      canCreate: privs.can('create'),
    };
  }

  async hasOngoing(projectId: ID, excludes: EngagementStatus[] = []) {
    const ids = await this.repo.getOngoingEngagementIds(projectId, excludes);
    return ids.length > 0;
  }

  protected async verifyRelationshipEligibility(
    projectId: ID,
    otherId: ID,
    isInternship: boolean,
    changeset?: ID,
  ): Promise<void> {
    const property = isInternship ? 'intern' : 'language';
    const result = await this.repo.verifyRelationshipEligibility(
      projectId,
      otherId,
      !isInternship,
      property,
      changeset,
    );

    if (!result?.project) {
      throw new NotFoundException(
        'Could not find project',
        'engagement.projectId',
      );
    }

    const isActuallyInternship =
      result.project.properties.type === ProjectType.Internship;
    if (isActuallyInternship !== isInternship) {
      throw new InputException(
        `Only ${
          isInternship ? 'Internship' : 'Language'
        } Engagements can be created on ${
          isInternship ? 'Internship' : 'Translation'
        } Projects`,
        `engagement.${property}Id`,
      );
    }

    const label = isInternship ? 'person' : 'language';
    if (!result?.other) {
      throw new NotFoundException(
        `Could not find ${label}`,
        `engagement.${property}Id`,
      );
    }

    if (result.engagement) {
      throw new DuplicateException(
        `engagement.${property}Id`,
        `Engagement for this project and ${label} already exists`,
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
        'languageEngagement.firstScripture',
      );
    }
    if (await this.repo.doOtherEngagementsHaveFirstScripture(id)) {
      throw new InputException(
        'Another engagement has already been marked as having done the first scripture',
        'languageEngagement.firstScripture',
      );
    }
  }
}
