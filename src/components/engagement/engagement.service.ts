import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  type CalendarDate,
  type ID,
  InputException,
  type ObjectView,
  type Range,
  RangeException,
  RequiredWhen,
  type ResourceShape,
  SecuredList,
  type UnsecuredDto,
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
import { type AnyChangesOf } from '~/core/database/changes';
import { Privileges } from '../authorization';
import { CeremonyService } from '../ceremony';
import { ProductService } from '../product';
import { type ProductListInput, type SecuredProductList } from '../product/dto';
import { ProjectLoader, ProjectService } from '../project';
import { IProject } from '../project/dto';
import {
  type CreateInternshipEngagement,
  type CreateLanguageEngagement,
  type Engagement,
  type EngagementListInput,
  type EngagementListOutput,
  EngagementStatus,
  InternshipEngagement,
  LanguageEngagement,
  resolveEngagementType,
  type UpdateInternshipEngagement,
  type UpdateLanguageEngagement,
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
    changeset?: ID,
  ): Promise<LanguageEngagement> {
    await this.verifyCreateEngagement(input.projectId);
    this.verifyCreationStatus(input.status);
    EngagementDateRangeException.throwIfInvalid(input);

    const engagement = await this.repo.createLanguageEngagement(
      input,
      changeset,
    );

    RequiredWhen.verify(LanguageEngagement, engagement);

    const event = new EngagementCreatedEvent(engagement, input);
    await this.eventBus.publish(event);

    return this.secure(event.engagement) as LanguageEngagement;
  }

  async createInternshipEngagement(
    input: CreateInternshipEngagement,
    changeset?: ID,
  ): Promise<InternshipEngagement> {
    await this.verifyCreateEngagement(input.projectId);
    this.verifyCreationStatus(input.status);
    EngagementDateRangeException.throwIfInvalid(input);

    const engagement = await this.repo.createInternshipEngagement(
      input,
      changeset,
    );

    RequiredWhen.verify(InternshipEngagement, engagement);

    const event = new EngagementCreatedEvent(engagement, input);
    await this.eventBus.publish(event);

    return this.secure(event.engagement) as InternshipEngagement;
  }

  private async verifyCreateEngagement(projectId: ID) {
    const projects = await this.resources.getLoader(ProjectLoader);
    const projectKey = { id: projectId, view: { active: true } } as const;
    const project = await projects.load(projectKey);
    projects.clear(projectKey);

    const projectPrivileges = this.privileges.for(IProject, {
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
    view?: ObjectView,
  ): Promise<LanguageEngagement | InternshipEngagement> {
    const dto = await this.repo.readOne(id, view);
    return this.secure(dto);
  }

  async readMany(ids: readonly ID[], view?: ObjectView) {
    const engagements = await this.repo.readMany(ids, view);
    return engagements.map((dto) => this.secure(dto));
  }

  private secure<E extends Engagement>(dto: UnsecuredDto<E>): E {
    const res = resolveEngagementType(dto) as unknown as ResourceShape<E>;
    return this.privileges.for(res).secure(dto);
  }

  async updateLanguageEngagement(
    input: UpdateLanguageEngagement,
    changeset?: ID,
  ): Promise<LanguageEngagement> {
    const view: ObjectView = viewOfChangeset(changeset);

    const previous = (await this.repo.readOne(
      input.id,
      view,
    )) as UnsecuredDto<LanguageEngagement>;
    const object = this.secure(previous);

    const { methodology, ...maybeChanges } = input;
    const changes = this.repo.getActualLanguageChanges(object, maybeChanges);
    if (changes.status) {
      await this.engagementRules.verifyStatusChange(
        input.id,
        changes.status,
        changeset,
      );
    }
    this.privileges.for(LanguageEngagement, object).verifyChanges(changes);
    EngagementDateRangeException.throwIfInvalid(previous, changes);

    const updated = await this.repo.updateLanguage(
      {
        id: object.id,
        ...changes,
      },
      changeset,
    );

    const prevMissing = RequiredWhen.calc(LanguageEngagement, previous);
    const nowMissing = RequiredWhen.calc(LanguageEngagement, updated);
    if (
      nowMissing &&
      (!prevMissing || nowMissing.missing.length >= prevMissing.missing.length)
    ) {
      throw nowMissing;
    }

    const event = new EngagementUpdatedEvent(updated, previous, {
      id: object.id,
      methodology,
      ...changes,
    });
    if (Object.keys(changes).length > 0) {
      await this.eventBus.publish(event);
    }

    return this.secure(event.updated) as LanguageEngagement;
  }

  async updateInternshipEngagement(
    input: UpdateInternshipEngagement,
    changeset?: ID,
  ): Promise<InternshipEngagement> {
    const view: ObjectView = viewOfChangeset(changeset);

    const previous = (await this.repo.readOne(
      input.id,
      view,
    )) as UnsecuredDto<InternshipEngagement>;
    const object = this.secure(previous);

    const changes = this.repo.getActualInternshipChanges(object, input);
    if (changes.status) {
      await this.engagementRules.verifyStatusChange(
        input.id,
        changes.status,
        changeset,
      );
    }
    this.privileges
      .for(InternshipEngagement, object)
      .verifyChanges(changes, { pathPrefix: 'engagement' });
    EngagementDateRangeException.throwIfInvalid(previous, changes);

    const updated = await this.repo.updateInternship(
      { id: object.id, ...changes },
      changeset,
    );

    const prevMissing = RequiredWhen.calc(InternshipEngagement, previous);
    const nowMissing = RequiredWhen.calc(InternshipEngagement, updated);
    if (
      nowMissing &&
      (!prevMissing || nowMissing.missing.length >= prevMissing.missing.length)
    ) {
      throw nowMissing;
    }

    const event = new EngagementUpdatedEvent(updated, previous, {
      id: object.id,
      ...changes,
    });
    if (Object.keys(changes).length > 0) {
      await this.eventBus.publish(event);
    }

    return this.secure(event.updated) as InternshipEngagement;
  }

  async triggerUpdateEvent(id: ID) {
    const object = await this.repo.readOne(id);
    const event = new EngagementUpdatedEvent(object, object, { id });
    await this.eventBus.publish(event);
  }

  async delete(id: ID, changeset?: ID): Promise<void> {
    const object = await this.readOne(id);

    this.privileges
      .for(resolveEngagementType(object), object)
      .verifyCan('delete');

    await this.eventBus.publish(new EngagementWillDeleteEvent(object));
    await this.repo.deleteNode(object, { changeset });
  }

  async list(
    input: EngagementListInput,
    view?: ObjectView,
  ): Promise<EngagementListOutput> {
    // -- don't have to check if canList because all roles can see at least on prop of it
    // if that ever changes, create a limitedScope and add to the list function.
    const results = await this.repo.list(input, view?.changeset);

    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }

  async listAllByProjectId(projectId: ID) {
    return await this.repo.listAllByProjectId(projectId);
  }

  async listProducts(
    engagement: LanguageEngagement,
    input: ProductListInput,
  ): Promise<SecuredProductList> {
    const privs = this.privileges
      .for(LanguageEngagement, engagement)
      .forEdge('product');

    if (!privs.can('read')) {
      return SecuredList.Redacted;
    }

    const result = await this.products.list({
      ...input,
      filter: {
        ...input.filter,
        engagementId: engagement.id,
      },
    });

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
