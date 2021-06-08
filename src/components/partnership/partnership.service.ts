import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  InputException,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { HandleIdLookup, IEventBus, ILogger, Logger } from '../../core';
import { runListQuery } from '../../core/database/results';
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
    session: Session
  ): Promise<Partnership> {
    const { projectId, partnerId } = input;

    await this.verifyRelationshipEligibility(projectId, partnerId);

    const isFirstPartnership = await this.repo.isFirstPartnership(projectId);
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
        session
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

      const partnership = await this.readOne(id, session);

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
    changeset?: ID
  ): Promise<Partnership> {
    this.logger.debug('readOne', { id, userId: session.userId });

    const result = await this.repo.readOne(id, session);

    const project = await this.projectService.readOne(
      result.projectId,
      session,
      changeset
    );

    const securedProps = await this.authorizationService.secureProperties(
      Partnership,
      result.props,
      session,
      result.scopedRoles
    );

    const canReadMouStart =
      project.mouStart.canRead && securedProps.mouStartOverride.canRead;
    const canReadMouEnd =
      project.mouEnd.canRead && securedProps.mouEndOverride.canRead;

    const mouStart = canReadMouStart
      ? securedProps.mouStartOverride.value ?? project.mouStart.value
      : null;
    const mouEnd = canReadMouEnd
      ? securedProps.mouEndOverride.value ?? project.mouEnd.value
      : null;

    return {
      ...result.props,
      ...securedProps,
      mouStart: {
        value: mouStart,
        canRead: canReadMouStart,
        canEdit: false, // edit the project mou or edit the partnership mou override
      },
      mouEnd: {
        value: mouEnd,
        canRead: canReadMouEnd,
        canEdit: false, // edit the project mou or edit the partnership mou override
      },
      types: {
        ...securedProps.types,
        value: securedProps.types.value || [],
      },
      partner: {
        ...securedProps.partner,
        value: result.partnerId,
      },
      canDelete: await this.repo.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdatePartnership, session: Session) {
    // mou start and end are now computed fields and do not get updated directly
    const object = await this.readOne(input.id, session);

    const partner = await this.partnerService.readOne(
      object.partner.value!,
      session
    );
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

    await this.repo.updateProperties(object, simpleChanges);
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

    const partnership = await this.readOne(input.id, session);
    const event = new PartnershipUpdatedEvent(
      partnership,
      object,
      input,
      session
    );
    await this.eventBus.publish(event);
    return event.updated;
  }

  async delete(id: ID, session: Session): Promise<void> {
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
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    partialInput: Partial<PartnershipListInput>,
    session: Session
  ): Promise<PartnershipListOutput> {
    const input = {
      ...PartnershipListInput.defaultVal,
      ...partialInput,
    };

    const query = this.repo.list(input, session);

    return await runListQuery(query, input, (id) => this.readOne(id, session));
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
    partnerId: ID
  ): Promise<void> {
    const result = await this.repo.verifyRelationshipEligibility(
      projectId,
      partnerId
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
