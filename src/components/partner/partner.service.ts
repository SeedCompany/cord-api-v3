import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  DuplicateException,
  ID,
  InputException,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { ConfigService, ILogger, Logger, OnIndex } from '../../core';
import {
  parseBaseNodeProperties,
  parsePropList,
  runListQuery,
} from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { FinancialReportingType } from '../partnership/dto/financial-reporting-type';
import {
  CreatePartner,
  Partner,
  PartnerListInput,
  PartnerListOutput,
  PartnerType,
  UpdatePartner,
} from './dto';
import { PartnerRepository } from './partner.repository';

@Injectable()
export class PartnerService {
  constructor(
    @Logger('partner:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly repo: PartnerRepository
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:Partner) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Partner) ASSERT n.id IS UNIQUE',

      'CREATE CONSTRAINT ON (n:Partner) ASSERT EXISTS(n.createdAt)',
    ];
  }

  async create(input: CreatePartner, session: Session): Promise<Partner> {
    this.verifyFinancialReportingType(
      input.financialReportingTypes,
      input.types
    );

    const checkPartner = await this.repo.checkPartner(input.organizationId);

    if (checkPartner) {
      throw new DuplicateException(
        'partner.organizationId',
        'Partner for organization already exists.'
      );
    }
    const createdAt = DateTime.local();

    const result = await this.repo.create(input, session, createdAt);

    if (!result) {
      throw new ServerException('failed to create partner');
    }

    if (input.pointOfContactId) {
      await this.repo.createProperty(input, result, createdAt);
    }

    await this.authorizationService.processNewBaseNode(
      Partner,
      result.id,
      session.userId
    );

    this.logger.debug(`partner created`, { id: result.id });
    return await this.readOne(result.id, session);
  }

  async readOnePartnerByOrgId(id: ID, session: Session): Promise<Partner> {
    this.logger.debug(`Read Partner by Org Id`, {
      id: id,
      userId: session.userId,
    });

    const result = await this.repo.readOnePartnerByOrgId(id);
    if (!result)
      throw new NotFoundException('No Partner Exists for this Org Id');

    return await this.readOne(result.partnerId, session);
  }

  async readOne(id: ID, session: Session): Promise<Partner> {
    this.logger.debug(`Read Partner by Partner Id`, {
      id: id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id, session);

    if (!result) {
      throw new NotFoundException('Could not find partner', 'partner.id');
    }

    const props = parsePropList(result.propList);
    const secured = await this.authorizationService.secureProperties(
      Partner,
      props,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      modifiedAt: props.modifiedAt,
      organization: {
        ...secured.organization,
        value: result.organizationId,
      },
      pointOfContact: {
        ...secured.pointOfContact,
        value: result.pointOfContactId,
      },
      types: {
        ...secured.types,
        value: secured.types.value || [],
      },
      financialReportingTypes: {
        ...secured.financialReportingTypes,
        value: secured.financialReportingTypes.value || [],
      },
      canDelete: await this.repo.checkDeletePermission(id, session),
    };
  }

  async update(input: UpdatePartner, session: Session): Promise<Partner> {
    const object = await this.readOne(input.id, session);

    if (
      !this.validateFinancialReportingType(
        input.financialReportingTypes ?? object.financialReportingTypes.value,
        input.types ?? object.types.value
      )
    ) {
      if (input.financialReportingTypes && input.types) {
        throw new InputException(
          'Financial reporting type can only be applied to managing partners',
          'partnership.financialReportingType'
        );
      }
      input = {
        ...input,
        financialReportingTypes: [],
      };
    }

    const changes = this.repo.getActualChanges(object, input);
    await this.authorizationService.verifyCanEditChanges(
      Partner,
      object,
      changes
    );
    const { pointOfContactId, ...simpleChanges } = changes;

    await this.repo.updateProperties(object, simpleChanges);

    if (pointOfContactId) {
      await this.repo.updatePartnerProperties(input, session);
    }
    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);
    if (!object) {
      throw new NotFoundException('Could not find Partner');
    }

    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Partner'
      );

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted partner with id`, { id });
  }

  async list(
    { filter, ...input }: PartnerListInput,
    session: Session
  ): Promise<PartnerListOutput> {
    const query = this.repo.list({ filter, ...input }, session);

    return await runListQuery(query, input, (id) => this.readOne(id, session));
  }

  protected verifyFinancialReportingType(
    financialReportingTypes: FinancialReportingType[] | undefined,
    types: PartnerType[] | undefined
  ) {
    if (!this.validateFinancialReportingType(financialReportingTypes, types)) {
      throw new InputException(
        'Financial reporting type can only be applied to managing partners',
        'partnership.financialReportingType'
      );
    }
  }

  protected validateFinancialReportingType(
    financialReportingTypes: FinancialReportingType[] | undefined,
    types: PartnerType[] | undefined
  ) {
    return financialReportingTypes?.length &&
      !types?.includes(PartnerType.Managing)
      ? false
      : true;
  }
}
