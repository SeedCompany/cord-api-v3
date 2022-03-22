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
} from '../../common';
import { HandleIdLookup, ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers } from '../authorization/dto/powers';
import { FinancialReportingType } from '../partnership/dto/financial-reporting-type';
import {
  ProjectListInput,
  ProjectService,
  SecuredProjectList,
} from '../project';
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
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    @Inject(forwardRef(() => ProjectService))
    private readonly projectService: ProjectService,
    private readonly repo: PartnerRepository
  ) {}

  async create(input: CreatePartner, session: Session): Promise<Partner> {
    await this.authorizationService.checkPower(Powers.CreatePartner, session);
    this.verifyFinancialReportingType(
      input.financialReportingTypes,
      input.types
    );

    const partnerExists = await this.repo.partnerIdByOrg(input.organizationId);
    if (partnerExists) {
      throw new DuplicateException(
        'partner.organizationId',
        'Partner for organization already exists.'
      );
    }

    const id = await this.repo.create(input, session);

    this.logger.debug(`Partner created`, { id });
    return await this.readOne(id, session);
  }

  async readOnePartnerByOrgId(id: ID, session: Session): Promise<Partner> {
    this.logger.debug(`Read Partner by Org Id`, {
      id: id,
      userId: session.userId,
    });

    const partnerId = await this.repo.partnerIdByOrg(id);
    if (!partnerId)
      throw new NotFoundException('No Partner Exists for this Org Id');

    return await this.readOne(partnerId, session);
  }

  @HandleIdLookup(Partner)
  async readOne(
    id: ID,
    session: Session,
    _view?: ObjectView
  ): Promise<Partner> {
    this.logger.debug(`Read Partner by Partner Id`, {
      id: id,
      userId: session.userId,
    });

    const result = await this.repo.readOne(id, session);
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const partners = await this.repo.readMany(ids, session);
    return await Promise.all(partners.map((dto) => this.secure(dto, session)));
  }

  private async secure(dto: UnsecuredDto<Partner>, session: Session) {
    const securedProps = await this.authorizationService.secureProperties(
      Partner,
      dto,
      session
    );

    return {
      ...dto,
      ...securedProps,
      types: {
        ...securedProps.types,
        value: securedProps.types.value || [],
      },
      financialReportingTypes: {
        ...securedProps.financialReportingTypes,
        value: securedProps.financialReportingTypes.value || [],
      },
      canDelete: await this.authorizationService.hasPower(
        session,
        Powers.DeletePartner
      ),
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
      await this.repo.updatePointOfContact(input.id, pointOfContactId, session);
    }

    return await this.readOne(input.id, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);
    if (!object) {
      throw new NotFoundException('Could not find Partner');
    }

    if (!object.canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Partner'
      );

    try {
      await this.repo.deleteNode(object);
    } catch (exception: any) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted partner with id`, { id });
  }

  async list(
    input: PartnerListInput,
    session: Session
  ): Promise<PartnerListOutput> {
    const limited = (await this.authorizationService.canList(Partner, session))
      ? // --- need a sensitivity mapping for global because several roles have a global and/or project sensitivity access for nearly all props.
        {
          ...(await this.authorizationService.getListRoleSensitivityMapping(
            Partner,
            'global'
          )),
          ...(await this.authorizationService.getListRoleSensitivityMapping(
            Partner,
            'project'
          )),
        }
      : await this.authorizationService.getListRoleSensitivityMapping(
          Partner,
          'project'
        );
    const results = await this.repo.list(input, session, limited);
    return await mapListResults(results, (dto) => this.secure(dto, session));
  }

  async listProjects(
    partner: Partner,
    input: ProjectListInput,
    session: Session
  ): Promise<SecuredProjectList> {
    const projectListOutput = await this.projectService.list(
      { ...input, filter: { ...input.filter, partnerId: partner.id } },
      session
    );

    return {
      ...projectListOutput,
      canRead: true,
      canCreate: await this.authorizationService.hasPower(
        session,
        Powers.CreateProject
      ),
    };
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
    financialReportingTypes: readonly FinancialReportingType[] | undefined,
    types: readonly PartnerType[] | undefined
  ) {
    return financialReportingTypes?.length &&
      !types?.includes(PartnerType.Managing)
      ? false
      : true;
  }
}
