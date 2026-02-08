import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  type CalendarDate,
  type ID,
  InputException,
  NotFoundException,
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
  ILogger,
  Logger,
  ResourceLoader,
} from '~/core';
import { type AnyChangesOf } from '~/core/database/changes';
import { Privileges } from '../authorization';
import { CeremonyService } from '../ceremony';
import { FileNodeLoader } from '../file';
import { type File } from '../file/dto';
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
  InternshipEngagementUpdate,
  LanguageEngagement,
  LanguageEngagementUpdate,
  resolveEngagementType,
  type UpdateInternshipEngagement,
  type UpdateLanguageEngagement,
} from './dto';
import { EngagementChannels } from './engagement.channels';
import { EngagementRepository } from './engagement.repository';
import { EngagementRules } from './engagement.rules';
import {
  EngagementCreatedHook,
  EngagementUpdatedHook,
  EngagementWillDeleteHook,
} from './hooks';

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
    private readonly hooks: Hooks,
    private readonly resources: ResourceLoader,
    private readonly channels: EngagementChannels,
    @Logger(`engagement:service`) private readonly logger: ILogger,
  ) {}

  async createLanguageEngagement(
    input: CreateLanguageEngagement,
    changeset?: ID,
  ): Promise<LanguageEngagement> {
    await this.verifyCreateEngagement(input.project);
    this.verifyCreationStatus(input.status);
    EngagementDateRangeException.throwIfInvalid(input);

    const engagement = await this.repo.createLanguageEngagement(
      input,
      changeset,
    );

    RequiredWhen.verify(LanguageEngagement, engagement);

    const event = new EngagementCreatedHook(engagement, input);
    await this.hooks.run(event);

    this.channels.publishToAll('language', 'created', {
      program: engagement.project.type,
      project: engagement.project.id,
      engagement: engagement.id,
      at: engagement.createdAt,
    });

    return this.secure(event.engagement) as LanguageEngagement;
  }

  async createInternshipEngagement(
    input: CreateInternshipEngagement,
    changeset?: ID,
  ): Promise<InternshipEngagement> {
    await this.verifyCreateEngagement(input.project);
    this.verifyCreationStatus(input.status);
    EngagementDateRangeException.throwIfInvalid(input);

    const engagement = await this.repo.createInternshipEngagement(
      input,
      changeset,
    );

    RequiredWhen.verify(InternshipEngagement, engagement);

    const event = new EngagementCreatedHook(engagement, input);
    await this.hooks.run(event);

    this.channels.publishToAll('internship', 'created', {
      program: engagement.project.type,
      project: engagement.project.id,
      engagement: engagement.id,
      at: engagement.createdAt,
    });

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
        'status',
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
  ) {
    const view: ObjectView = viewOfChangeset(changeset);

    const previous = (await this.repo.readOne(
      input.id,
      view,
    )) as UnsecuredDto<LanguageEngagement>;
    const object = this.secure(previous);

    const { methodology, ...maybeChanges } = input;
    const changes = this.repo.getActualLanguageChanges(object, maybeChanges);
    if (Object.keys(changes).length === 0) {
      return { engagement: object };
    }
    if (changes.status) {
      await this.engagementRules.verifyStatusChange(
        input.id,
        changes.status,
        changeset,
      );
    }
    this.privileges.for(LanguageEngagement, object).verifyChanges(changes);
    EngagementDateRangeException.throwIfInvalid(previous, changes);

    const fileLoader = await this.resources.getLoader(FileNodeLoader);
    const prevPnp = previous.pnp
      ? ((await fileLoader.load(previous.pnp.id).catch((e) => {
          if (e instanceof NotFoundException) {
            // If no version uploaded, then null
            return null;
          }
          throw e;
        })) as File)
      : null;
    if (prevPnp && changes.pnp) {
      // If we are about to change the file, clear the cache so a stale file is not used
      fileLoader.clear(prevPnp.id);
    }

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

    const event = new EngagementUpdatedHook(updated, previous, {
      id: object.id,
      methodology,
      ...changes,
    });
    await this.hooks.run(event);

    const { pnp, ...simplePrevious } = previous;
    const { pnp: newPnp, ...simpleChanges } = changes;
    const updatedPayload = this.channels.publishToAll('language', 'updated', {
      program: updated.project.type,
      project: updated.project.id,
      engagement: updated.id,
      at: changes.modifiedAt!,
      updated: {
        ...LanguageEngagementUpdate.fromInput(simpleChanges),
        // TODO FWIW this doesn't work for direct file uploads, but that
        //  isn't used by UI in production, so I'm not too concerned about it.
        pnp: newPnp?.upload ? { id: newPnp.upload } : undefined,
      },
      previous: {
        ...LanguageEngagementUpdate.pickPrevious(simplePrevious, changes),
        pnp: prevPnp ? { id: prevPnp.latestVersionId } : undefined,
      },
    });

    return {
      engagement: this.secure(event.updated) as LanguageEngagement,
      payload: updatedPayload,
    };
  }

  async updateInternshipEngagement(
    input: UpdateInternshipEngagement,
    changeset?: ID,
  ) {
    const view: ObjectView = viewOfChangeset(changeset);

    const previous = (await this.repo.readOne(
      input.id,
      view,
    )) as UnsecuredDto<InternshipEngagement>;
    const object = this.secure(previous);

    const changes = this.repo.getActualInternshipChanges(object, input);
    if (Object.keys(changes).length === 0) {
      return { engagement: object };
    }
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

    const fileLoader = await this.resources.getLoader(FileNodeLoader);
    const prevGrowthPlan = previous.growthPlan
      ? ((await fileLoader.load(previous.growthPlan.id).catch((e) => {
          if (e instanceof NotFoundException) {
            // If no version uploaded, then null
            return null;
          }
          throw e;
        })) as File)
      : null;
    if (prevGrowthPlan && changes.growthPlan) {
      // If we are about to change the file, clear the cache so a stale file is not used
      fileLoader.clear(prevGrowthPlan.id);
    }

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

    const event = new EngagementUpdatedHook(updated, previous, {
      id: object.id,
      ...changes,
    });
    await this.hooks.run(event);

    const { growthPlan, ...simplePrevious } = previous;
    const { growthPlan: newGrowthPlan, ...simpleChanges } = changes;
    const updatedPayload = this.channels.publishToAll('internship', 'updated', {
      program: updated.project.type,
      project: updated.project.id,
      engagement: updated.id,
      at: changes.modifiedAt!,
      updated: {
        ...InternshipEngagementUpdate.fromInput(simpleChanges),
        growthPlan: newGrowthPlan?.upload
          ? { id: newGrowthPlan.upload }
          : undefined,
      },
      previous: {
        ...InternshipEngagementUpdate.pickPrevious(simplePrevious, changes),
        growthPlan: prevGrowthPlan
          ? { id: prevGrowthPlan.latestVersionId }
          : undefined,
      },
    });

    return {
      engagement: this.secure(event.updated) as InternshipEngagement,
      payload: updatedPayload,
    };
  }

  async triggerUpdateEvent(id: ID) {
    const object = await this.repo.readOne(id);
    const event = new EngagementUpdatedHook(object, object, { id });
    await this.hooks.run(event);
  }

  async delete(id: ID, changeset?: ID) {
    const object = await this.readOne(id);

    this.privileges
      .for(resolveEngagementType(object), object)
      .verifyCan('delete');

    await this.hooks.run(new EngagementWillDeleteHook(object));
    const { at } = await this.repo.deleteNode(object, { changeset });

    const payload = this.channels.publishToAll(
      resolveEngagementType(object) === LanguageEngagement
        ? 'language'
        : 'internship',
      'deleted',
      {
        program: object.project.type,
        project: object.project.id,
        engagement: object.id,
        at,
      },
    );
    return { engagement: object, payload };
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

  constructor(
    readonly value: Range<CalendarDate>,
    readonly field: string,
  ) {
    const message = "Engagement's start date must be before the end date";
    super({ message, field });
  }
}
