import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  ObjectView,
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
import { Privileges } from '../authorization';
import { CeremonyService } from '../ceremony';
import { FileService } from '../file';
import { ProductService } from '../product';
import { ProductListInput, SecuredProductList } from '../product/dto';
import { ProjectService } from '../project';
import { IProject } from '../project/dto';
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
    await this.verifyCreateEngagement(input.projectId, session);
    this.verifyCreationStatus(input.status);

    const engagement = await this.repo.createLanguageEngagement(
      input,
      session,
      changeset,
    );

    const event = new EngagementCreatedEvent(engagement, input, session);
    await this.eventBus.publish(event);

    return this.secure(event.engagement, session) as LanguageEngagement;
  }

  async createInternshipEngagement(
    input: CreateInternshipEngagement,
    session: Session,
    changeset?: ID,
  ): Promise<InternshipEngagement> {
    await this.verifyCreateEngagement(input.projectId, session);
    this.verifyCreationStatus(input.status);

    const { id } = await this.repo.createInternshipEngagement(
      input,
      session,
      changeset,
    );

    const engagement = await this.repo.readOne(
      id,
      session,
      viewOfChangeset(changeset),
    );

    const event = new EngagementCreatedEvent(engagement, input, session);
    await this.eventBus.publish(event);

    return this.secure(event.engagement, session) as InternshipEngagement;
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

  @HandleIdLookup([LanguageEngagement, InternshipEngagement])
  async readOne(
    id: ID,
    session: Session,
    view?: ObjectView,
  ): Promise<LanguageEngagement | InternshipEngagement> {
    const dto = await this.repo.readOne(id, session, view);
    return this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session, view?: ObjectView) {
    const engagements = await this.repo.readMany(ids, session, view);
    return engagements.map((dto) => this.secure(dto, session));
  }

  secure(dto: UnsecuredDto<Engagement>, session: Session): Engagement {
    return this.privileges.for(session, resolveEngagementType(dto)).secure(dto);
  }

  async updateLanguageEngagement(
    input: UpdateLanguageEngagement,
    session: Session,
    changeset?: ID,
  ): Promise<LanguageEngagement> {
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
    const object = this.secure(previous, session) as LanguageEngagement;

    const { methodology: _, ...maybeChanges } = input;
    const changes = this.repo.getActualLanguageChanges(object, maybeChanges);
    this.privileges
      .for(session, LanguageEngagement, object)
      .verifyChanges(changes);

    const updated = await this.repo.updateLanguage(
      {
        id: object.id,
        ...changes,
      },
      session,
      changeset,
    );

    const event = new EngagementUpdatedEvent(updated, previous, input, session);
    await this.eventBus.publish(event);

    return this.secure(event.updated, session) as LanguageEngagement;
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
    const object = this.secure(previous, session) as InternshipEngagement;

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

    const updated = await this.repo.updateInternship(
      { id: object.id, ...changes },
      session,
      changeset,
    );

    const event = new EngagementUpdatedEvent(updated, previous, input, session);
    await this.eventBus.publish(event);

    return this.secure(event.updated, session) as InternshipEngagement;
  }

  async triggerUpdateEvent(id: ID, session: Session) {
    const object = await this.repo.readOne(id, session);
    const event = new EngagementUpdatedEvent(object, object, { id }, session);
    await this.eventBus.publish(event);
  }

  async delete(id: ID, session: Session, changeset?: ID): Promise<void> {
    const object = await this.readOne(id, session);

    this.privileges
      .for(session, resolveEngagementType(object), object)
      .verifyCan('delete');

    await this.eventBus.publish(new EngagementWillDeleteEvent(object, session));
    await this.repo.deleteNode(object, { changeset });
  }

  async list(
    input: EngagementListInput,
    session: Session,
    view?: ObjectView,
  ): Promise<EngagementListOutput> {
    // -- don't have to check if canList because all roles can see at least on prop of it
    // if that ever changes, create a limitedScope and add to the list function.
    const results = await this.repo.list(input, session, view?.changeset);

    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
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
}
