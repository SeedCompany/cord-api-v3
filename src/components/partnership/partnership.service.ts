import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  InputException,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
  viewOfChangeset,
} from '../../common';
import { HandleIdLookup, IEventBus, ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
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
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    private readonly partnerService: PartnerService,
    private readonly eventBus: IEventBus,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: PartnershipRepository,
    @Logger('partnership:service') private readonly logger: ILogger
  ) {}

  async create(
    input: CreatePartnership,
    session: Session,
    changeset?: ID
  ): Promise<Partnership> {
    const { projectId, partnerId } = input;

    await this.verifyRelationshipEligibility(projectId, partnerId, changeset);

    const isFirstPartnership = await this.repo.isFirstPartnership(
      projectId,
      changeset
    );
    const primary = isFirstPartnership ? true : input.primary;

    const partner = await this.partnerService.readOne(partnerId, session);
    this.verifyFinancialReportingType(
      input.financialReportingType,
      input.types ?? [],
      partner
    );

    try {
      const { id, mouId, agreementId } = await this.repo.create(
        {
          ...input,
          primary,
        },
        session,
        changeset
      );

      await this.files.createDefinedFile(
        mouId,
        `MOU`,
        session,
        id,
        'mou',
        input.mou,
        'partnership.mou'
      );

      await this.files.createDefinedFile(
        agreementId,
        `Partner Agreement`,
        session,
        id,
        'agreement',
        input.agreement,
        'partnership.agreement'
      );

      await this.authorizationService.processNewBaseNode(
        Partnership,
        id,
        session.userId
      );

      if (primary) {
        await this.repo.removePrimaryFromOtherPartnerships(id);
      }

      const partnership = await this.readOne(
        id,
        session,
        viewOfChangeset(changeset)
      );

      await this.eventBus.publish(
        new PartnershipCreatedEvent(partnership, session)
      );

      return partnership;
    } catch (exception) {
      this.logger.warning('Failed to create partnership', {
        exception,
      });

      throw new ServerException('Failed to create partnership', exception);
    }
  }

  @HandleIdLookup(Partnership)
  async readOne(
    id: ID,
    session: Session,
    view?: ObjectView
  ): Promise<Partnership> {
    const dto = await this.readOneUnsecured(id, session, view);
    return await this.secure(dto, session);
  }

  async readOneUnsecured(
    id: ID,
    session: Session,
    view?: ObjectView
  ): Promise<UnsecuredDto<Partnership>> {
    this.logger.debug('readOne', { id, userId: session.userId });
    return await this.repo.readOne(id, session, view);
  }

  async secure(
    dto: UnsecuredDto<Partnership>,
    session: Session
  ): Promise<Partnership> {
    const securedProps = await this.authorizationService.secureProperties(
      Partnership,
      dto,
      session
    );

    return {
      ...dto,
      ...securedProps,
      mouStart: {
        ...securedProps.mouStart,
        canEdit: false, // edit the project mou or edit the partnership mou override
      },
      mouEnd: {
        ...securedProps.mouEnd,
        canEdit: false, // edit the project mou or edit the partnership mou override
      },
      types: {
        ...securedProps.types,
        value: securedProps.types.value ?? [],
      },
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
    };
  }

  async update(input: UpdatePartnership, session: Session, view?: ObjectView) {
    const existing = await this.repo.readOne(input.id, session, view);
    const partner = await this.partnerService.readOne(
      existing.partner,
      session
    );
    const object = await this.secure(existing, session);

    try {
      this.verifyFinancialReportingType(
        input.financialReportingType ?? object.financialReportingType.value,
        input.types ?? object.types.value,
        partner
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
        'partnership.primary'
      );
    }

    const changes = this.repo.getActualChanges(object, input);
    await this.authorizationService.verifyCanEditChanges(
      Partnership,
      object,
      changes
    );
    const { mou, agreement, ...simpleChanges } = changes;

    if (changes.primary) {
      await this.repo.removePrimaryFromOtherPartnerships(input.id);
    }

    await this.repo.updateProperties(object, simpleChanges, view?.changeset);
    await this.files.updateDefinedFile(
      object.mou,
      'partnership.mou',
      mou,
      session
    );
    await this.files.updateDefinedFile(
      object.agreement,
      'partnership.agreement',
      agreement,
      session
    );

    const partnership = await this.readOne(input.id, session, view);
    const event = new PartnershipUpdatedEvent(
      partnership,
      object,
      input,
      session
    );
    await this.eventBus.publish(event);
    return event.updated;
  }

  async delete(id: ID, session: Session, changeset?: ID): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException(
        'Could not find partnership',
        'partnership.id'
      );
    }
    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Partnership'
      );

    // only primary one partnership could be removed
    if (object.primary.value) {
      const isOthers = await this.repo.isAnyOtherPartnerships(object.id);
      if (isOthers) {
        throw new InputException(
          'Primary partnerships cannot be removed. Make another partnership primary first.',
          'partnership.id'
        );
      }
    }

    await this.eventBus.publish(
      new PartnershipWillDeleteEvent(object, session)
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
    changeset?: ID
  ): Promise<PartnershipListOutput> {
    const input = {
      ...PartnershipListInput.defaultVal,
      ...partialInput,
    };

    const limited = (await this.authorizationService.canList(
      Partnership,
      session
    ))
      ? undefined
      : await this.authorizationService.getListRoleSensitivityMapping(
          Partnership
        );

    const results = await this.repo.list(input, session, changeset, limited);
    return await mapListResults(results, (id) =>
      this.readOne(id, session, viewOfChangeset(changeset))
    );
  }

  protected verifyFinancialReportingType(
    financialReportingType: FinancialReportingType | null | undefined,
    types: PartnerType[],
    partner: Partner
  ) {
    if (!financialReportingType) {
      return;
    }
    if (
      !partner.financialReportingTypes.value?.includes(financialReportingType)
    ) {
      throw new InputException(
        `Partner does not have this financial reporting type available`,
        'partnership.financialReportingType'
      );
    }
    if (!types.includes(PartnerType.Managing)) {
      throw new InputException(
        'Financial reporting type can only be applied to managing partners',
        'partnership.financialReportingType'
      );
    }
  }

  protected async verifyRelationshipEligibility(
    projectId: ID,
    partnerId: ID,
    changeset?: ID
  ): Promise<void> {
    const result = await this.repo.verifyRelationshipEligibility(
      projectId,
      partnerId,
      changeset
    );

    if (!result.project) {
      throw new NotFoundException(
        'Could not find project',
        'partnership.projectId'
      );
    }

    if (!result.partner) {
      throw new NotFoundException(
        'Could not find partner',
        'partnership.partnerId'
      );
    }

    if (result.partnership) {
      throw new DuplicateException(
        'partnership.projectId',
        'Partnership for this project and partner already exists'
      );
    }
  }
}
