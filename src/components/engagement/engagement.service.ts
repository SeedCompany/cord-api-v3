import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  CalendarDate,
  ID,
  InputException,
  ObjectView,
  Range,
  RangeException,
  RequiredWhen,
  ResourceShape,
  SecuredList,
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
import { AnyChangesOf } from '~/core/database/changes';
import { Privileges } from '../authorization';
import { CeremonyService } from '../ceremony';
import { ProductService } from '../product';
import { ProductListInput, SecuredProductList } from '../product/dto';
import { ProjectLoader, ProjectService } from '../project';
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
    EngagementDateRangeException.throwIfInvalid(input);

    const engagement = await this.repo.createLanguageEngagement(
      input,
      session,
      changeset,
    );

    RequiredWhen.verify(LanguageEngagement, engagement);

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
    EngagementDateRangeException.throwIfInvalid(input);

    const engagement = await this.repo.createInternshipEngagement(
      input,
      session,
      changeset,
    );

    RequiredWhen.verify(InternshipEngagement, engagement);

    const event = new EngagementCreatedEvent(engagement, input, session);
    await this.eventBus.publish(event);

    return this.secure(event.engagement, session) as InternshipEngagement;
  }

  private async verifyCreateEngagement(projectId: ID, session: Session) {
    const projects = await this.resources.getLoader(ProjectLoader);
    const projectKey = { id: projectId, view: { active: true } } as const;
    const project = await projects.load(projectKey);
    projects.clear(projectKey);

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

  private secure<E extends Engagement>(
    dto: UnsecuredDto<E>,
    session: Session,
  ): E {
    const res = resolveEngagementType(dto) as unknown as ResourceShape<E>;
    return this.privileges.for(session, res).secure(dto);
  }

  async updateLanguageEngagement(
    input: UpdateLanguageEngagement,
    session: Session,
    changeset?: ID,
  ): Promise<LanguageEngagement> {
    const view: ObjectView = viewOfChangeset(changeset);

    const previous = (await this.repo.readOne(
      input.id,
      session,
      view,
    )) as UnsecuredDto<LanguageEngagement>;
    const object = this.secure(previous, session);

    if (input.status && input.status !== previous.status) {
      await this.engagementRules.verifyStatusChange(
        input.id,
        session,
        input.status,
        changeset,
      );
    }

    const { methodology, ...maybeChanges } = input;
    const changes = this.repo.getActualLanguageChanges(object, maybeChanges);
    this.privileges
      .for(session, LanguageEngagement, object)
      .verifyChanges(changes);
    EngagementDateRangeException.throwIfInvalid(previous, changes);

    const updated = await this.repo.updateLanguage(
      {
        id: object.id,
        ...changes,
      },
      session,
      changeset,
    );

    RequiredWhen.verify(LanguageEngagement, updated);

    const event = new EngagementUpdatedEvent(
      updated,
      previous,
      { id: object.id, methodology, ...changes },
      session,
    );
    if (Object.keys(changes).length > 0) {
      await this.eventBus.publish(event);
    }

    return this.secure(event.updated, session) as LanguageEngagement;
  }

  async updateInternshipEngagement(
    input: UpdateInternshipEngagement,
    session: Session,
    changeset?: ID,
  ): Promise<InternshipEngagement> {
    const view: ObjectView = viewOfChangeset(changeset);

    const previous = (await this.repo.readOne(
      input.id,
      session,
      view,
    )) as UnsecuredDto<InternshipEngagement>;
    const object = this.secure(previous, session);

    if (input.status && input.status !== previous.status) {
      await this.engagementRules.verifyStatusChange(
        input.id,
        session,
        input.status,
        changeset,
      );
    }

    const changes = this.repo.getActualInternshipChanges(object, input);
    this.privileges
      .for(session, InternshipEngagement, object)
      .verifyChanges(changes, { pathPrefix: 'engagement' });
    EngagementDateRangeException.throwIfInvalid(previous, changes);

    const updated = await this.repo.updateInternship(
      { id: object.id, ...changes },
      session,
      changeset,
    );

    RequiredWhen.verify(InternshipEngagement, updated);

    const event = new EngagementUpdatedEvent(
      updated,
      previous,
      { id: object.id, ...changes },
      session,
    );
    if (Object.keys(changes).length > 0) {
      await this.eventBus.publish(event);
    }

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
}

class EngagementDateRangeException extends RangeException {
  static throwIfInvalid(
    current: Partial<
      Pick<UnsecuredDto<Engagement>, 'startDateOverride' | 'endDateOverride'>
    >,
    changes: AnyChangesOf<Engagement> = {},
  ) {
    const start =
      changes.startDateOverride !== undefined
        ? changes.startDateOverride
        : current.startDateOverride;
    const end =
      changes.endDateOverride !== undefined
        ? changes.endDateOverride
        : current.endDateOverride;
    if (start && end && start > end) {
      const field =
        changes.endDateOverride !== undefined
          ? 'engagement.endDateOverride'
          : 'engagement.startDateOverride';
      throw new EngagementDateRangeException({ start, end }, field);
    }
  }

  constructor(readonly value: Range<CalendarDate>, readonly field: string) {
    const message = "Engagement's start date must be before the end date";
    super({ message, field });
  }
}
