import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  ID,
  InputException,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
  viewOfChangeset,
} from '../../common';
import {
  HandleIdLookup,
  IEventBus,
  ILogger,
  Logger,
  ResourceLoader,
} from '../../core';
import { Privileges } from '../authorization';
import { FileService } from '../file';
import { Partner, PartnerService, PartnerType } from '../partner';
import { ProjectService } from '../project';
import {
  CreatePartnership,
  FinancialReportingType,
  Partnership,
  PartnershipListInput,
  PartnershipListOutput,
  UpdatePartnership,
} from './dto';
import {
  PartnershipCreatedEvent,
  PartnershipUpdatedEvent,
  PartnershipWillDeleteEvent,
} from './events';
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

  async create(
    input: CreatePartnership,
    session: Session,
    changeset?: ID,
  ): Promise<Partnership> {
    const { projectId, partnerId } = input;

    const isFirstPartnership = await this.repo.isFirstPartnership(
      projectId,
      changeset,
    );
    const primary = isFirstPartnership ? true : input.primary;

    const partner = await this.partnerService.readOne(partnerId, session);
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
        session,
        changeset,
      );

      if (primary) {
        await this.repo.removePrimaryFromOtherPartnerships(result.id);
      }

      const partnership = await this.readOne(
        result.id,
        session,
        viewOfChangeset(changeset),
      );

      this.privileges
        .for(session, Partnership, partnership)
        .verifyCan('create');

      await this.eventBus.publish(
        new PartnershipCreatedEvent(partnership, session),
      );

      return partnership;
    } catch (exception) {
      if (exception instanceof InputException) {
        throw exception;
      }
      throw new ServerException('Failed to create partnership', exception);
    }
  }

  @HandleIdLookup(Partnership)
  async readOne(
    id: ID,
    session: Session,
    view?: ObjectView,
  ): Promise<Partnership> {
    const dto = await this.repo.readOne(id, session, view);
    return this.secure(dto, session);
  }

  async readMany(ids: readonly ID[], session: Session, view?: ObjectView) {
    const partnerships = await this.repo.readMany(ids, session, view);
    return partnerships.map((dto) => this.secure(dto, session));
  }

  secure(dto: UnsecuredDto<Partnership>, session: Session) {
    return this.privileges.for(session, Partnership).secure(dto);
  }

  async update(input: UpdatePartnership, session: Session, view?: ObjectView) {
    const existing = await this.repo.readOne(input.id, session, view);
    const partner = await this.partnerService.readOne(
      existing.partner.id,
      session,
    );
    const object = this.secure(existing, session);

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
    this.privileges.for(session, Partnership, object).verifyChanges(changes);
    const { mou, agreement, ...simpleChanges } = changes;

    if (changes.primary) {
      await this.repo.removePrimaryFromOtherPartnerships(input.id);
    }

    await this.repo.update(
      { id: object.id, ...simpleChanges },
      view?.changeset,
    );

    // TODO: remove negation. Temporary fix until file handling is refactored
    if (!object.mou) {
      await this.files.updateDefinedFile(
        object.mou,
        'partnership.mou',
        mou,
        session,
      );
    }
    // TODO: remove negation. Temporary fix until file handling is refactored
    if (!object.agreement) {
      await this.files.updateDefinedFile(
        object.agreement,
        'partnership.agreement',
        agreement,
        session,
      );
    }

    const partnership = await this.readOne(input.id, session, view);
    const event = new PartnershipUpdatedEvent(
      partnership,
      object,
      input,
      session,
    );
    await this.eventBus.publish(event);
    return event.updated;
  }

  async delete(id: ID, session: Session, changeset?: ID): Promise<void> {
    const object = await this.readOne(id, session);

    this.privileges.for(session, Partnership, object).verifyCan('delete');

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

    await this.eventBus.publish(
      new PartnershipWillDeleteEvent(object, session),
    );

    try {
      await this.repo.deleteNode(object, changeset);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    partialInput: Partial<PartnershipListInput>,
    session: Session,
    changeset?: ID,
  ): Promise<PartnershipListOutput> {
    const input = PartnershipListInput.defaultValue(
      PartnershipListInput,
      partialInput,
    );
    const results = await this.repo.list(input, session, changeset);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
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
      !partner.financialReportingTypes.value?.includes(financialReportingType)
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
