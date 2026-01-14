import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  type CalendarDate,
  CreationFailed,
  type ID,
  InputException,
  NotFoundException,
  type ObjectView,
  type Range,
  RangeException,
  ReadAfterCreationFailed,
  ServerException,
  type UnsecuredDto,
  viewOfChangeset,
} from '~/common';
import {
  HandleIdLookup,
  IEventBus,
  ILogger,
  Logger,
  ResourceLoader,
} from '~/core';
import { type AnyChangesOf } from '~/core/database/changes';
import { Privileges } from '../authorization';
import { FileService } from '../file';
import { PartnerService } from '../partner';
import { type Partner, PartnerType } from '../partner/dto';
import { ProjectService } from '../project';
import {
  type CreatePartnership,
  type FinancialReportingType,
  Partnership,
  PartnershipListInput,
  type PartnershipListOutput,
  type UpdatePartnership,
} from './dto';
import {
  PartnershipCreatedEvent,
  PartnershipUpdatedEvent,
  PartnershipWillDeleteEvent,
} from './events';
import type { PartnershipByProjectAndPartnerInput } from './partnership-by-project-and-partner.loader';
import { PartnershipRepository } from './partnership.repository';

@Injectable()
export class PartnershipService {
  constructor(
    private readonly files: FileService,
    @Inject(forwardRef(() => PartnerService))
    private readonly partnerService: PartnerService & {},
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService & {},
    private readonly privileges: Privileges,
    private readonly eventBus: IEventBus,
    private readonly repo: PartnershipRepository,
    private readonly resourceLoader: ResourceLoader,
    @Logger('partnership:service') private readonly logger: ILogger,
  ) {}

  async create(input: CreatePartnership, changeset?: ID): Promise<Partnership> {
    const { projectId, partnerId } = input;

    PartnershipDateRangeException.throwIfInvalid(input);

    const [_project, partner] = await Promise.all([
      this.resourceLoader.load('Project', projectId).catch((e) => {
        throw e instanceof NotFoundException
          ? new NotFoundException(
              'Could not find project',
              'partnership.projectId',
              e,
            )
          : e;
      }),
      this.resourceLoader.load('Partner', partnerId).catch((e) => {
        throw e instanceof NotFoundException
          ? new NotFoundException(
              'Could not find partner',
              'partnership.partnerId',
              e,
            )
          : e;
      }),
    ]);

    const isFirstPartnership = await this.repo.isFirstPartnership(
      projectId,
      changeset,
    );
    const primary = isFirstPartnership ? true : input.primary;

    this.verifyFinancialReportingType(
      input.financialReportingType,
      input.types ?? [],
      partner,
    );

    try {
      const result = await this.repo.create(
        {
          ...input,
          primary,
        },
        changeset,
      );

      if (primary) {
        await this.repo.removePrimaryFromOtherPartnerships(result.id);
      }

      const partnership = await this.readOne(
        result.id,
        viewOfChangeset(changeset),
      ).catch((e) => {
        throw e instanceof NotFoundException
          ? new ReadAfterCreationFailed(Partnership)
          : e;
      });

      this.privileges.for(Partnership, partnership).verifyCan('create');

      await this.eventBus.publish(new PartnershipCreatedEvent(partnership));

      return partnership;
    } catch (exception) {
      if (exception instanceof InputException) {
        throw exception;
      }
      throw new CreationFailed(Partnership, { cause: exception });
    }
  }

  @HandleIdLookup(Partnership)
  async readOne(id: ID, view?: ObjectView): Promise<Partnership> {
    const dto = await this.repo.readOne(id, view);
    return this.secure(dto);
  }

  async readMany(ids: readonly ID[], view?: ObjectView) {
    const partnerships = await this.repo.readMany(ids, view);
    return partnerships.map((dto) => this.secure(dto));
  }

  async readManyByProjectAndPartner(
    input: readonly PartnershipByProjectAndPartnerInput[],
  ) {
    const partnerships = await this.repo.readManyByProjectAndPartner(input);
    return partnerships.map((dto) => ({
      id: { project: dto.project.id, partner: dto.partner.id },
      partnership: this.secure(dto),
    }));
  }

  async listAllByProjectId(projectId: ID) {
    return await this.repo.listAllByProjectId(projectId);
  }

  secure(dto: UnsecuredDto<Partnership>) {
    return this.privileges.for(Partnership).secure(dto);
  }

  async update(input: UpdatePartnership, view?: ObjectView) {
    const existing = await this.repo.readOne(input.id, view);
    const partner = await this.partnerService.readOne(existing.partner.id);
    const object = this.secure(existing);

    try {
      this.verifyFinancialReportingType(
        input.financialReportingType ?? object.financialReportingType.value,
        input.types ?? object.types.value,
        partner,
      );
    } catch (e) {
      if (input.types && !input.financialReportingType) {
        // If input is removing Managing type and FRT is omitted, help caller
        // out and just remove FRT as well, instead of throwing error.
        input = {
          ...input,
          financialReportingType: null,
        };
      } else {
        throw e;
      }
    }

    if (input.primary === false) {
      throw new InputException(
        'To remove primary from this partnership, set another partnership as the primary',
        'partnership.primary',
      );
    }

    const changes = this.repo.getActualChanges(object, input);
    this.privileges.for(Partnership, object).verifyChanges(changes);
    const { mou, agreement, ...simpleChanges } = changes;

    PartnershipDateRangeException.throwIfInvalid(existing, changes);

    if (changes.primary) {
      await this.repo.removePrimaryFromOtherPartnerships(input.id);
    }

    await this.repo.update(
      { id: object.id, ...simpleChanges },
      view?.changeset,
    );

    // TODO: remove negation. Temporary fix until file handling is refactored
    if (!object.mou) {
      await this.files.updateDefinedFile(object.mou, 'partnership.mou', mou);
    }
    // TODO: remove negation. Temporary fix until file handling is refactored
    if (!object.agreement) {
      await this.files.updateDefinedFile(
        object.agreement,
        'partnership.agreement',
        agreement,
      );
    }

    const partnership = await this.readOne(input.id, view);
    const event = new PartnershipUpdatedEvent(partnership, object, input);
    await this.eventBus.publish(event);
    return event.updated;
  }

  async delete(id: ID, changeset?: ID): Promise<void> {
    const object = await this.readOne(id);

    this.privileges.for(Partnership, object).verifyCan('delete');

    // only primary one partnership could be removed
    if (object.primary.value) {
      const isOthers = await this.repo.isAnyOtherPartnerships(object.id);
      if (isOthers) {
        throw new InputException(
          'Primary partnerships cannot be removed. Make another partnership primary first.',
          'partnership.id',
        );
      }
    }

    await this.eventBus.publish(new PartnershipWillDeleteEvent(object));

    try {
      await this.repo.deleteNode(object, { changeset });
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    partialInput: Partial<PartnershipListInput>,
    changeset?: ID,
  ): Promise<PartnershipListOutput> {
    const input = PartnershipListInput.defaultValue(
      PartnershipListInput,
      partialInput,
    );
    const results = await this.repo.list(input, changeset);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
    };
  }

  protected verifyFinancialReportingType(
    financialReportingType: FinancialReportingType | null | undefined,
    types: readonly PartnerType[],
    partner: Partner,
  ) {
    if (!financialReportingType) {
      return;
    }
    if (
      !partner.financialReportingTypes.value.includes(financialReportingType)
    ) {
      throw new InputException(
        `Partner does not have this financial reporting type available`,
        'partnership.financialReportingType',
      );
    }
    if (!types.includes(PartnerType.Managing)) {
      throw new InputException(
        'Financial reporting type can only be applied to managing partners',
        'partnership.financialReportingType',
      );
    }
  }
}

class PartnershipDateRangeException extends RangeException {
  static throwIfInvalid(
    current: Partial<
      Pick<UnsecuredDto<Partnership>, 'mouStartOverride' | 'mouEndOverride'>
    >,
    changes: AnyChangesOf<Partnership> = {},
  ) {
    const start =
      changes.mouStartOverride !== undefined
        ? changes.mouStartOverride
        : current.mouStartOverride;
    const end =
      changes.mouEndOverride !== undefined
        ? changes.mouEndOverride
        : current.mouEndOverride;
    if (start && end && start > end) {
      const field =
        changes.mouEndOverride !== undefined
          ? 'partnership.mouEndOverride'
          : 'partnership.mouStartOverride';
      throw new PartnershipDateRangeException({ start, end }, field);
    }
  }

  constructor(
    readonly value: Range<CalendarDate>,
    readonly field: string,
  ) {
    const message =
      "Partnership's MOU start date must be before the MOU end date";
    super({ message, field });
  }
}
