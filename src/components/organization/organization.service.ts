import { forwardRef, Inject, Injectable } from '@nestjs/common';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ObjectView,
  ServerException,
  Session,
  UnauthorizedException,
  UnsecuredDto,
} from '../../common';
import { ConfigService, HandleIdLookup, ILogger, Logger } from '../../core';
import { mapListResults } from '../../core/database/results';
import { AuthorizationService } from '../authorization/authorization.service';
import { Powers } from '../authorization/dto/powers';
import {
  LocationListInput,
  LocationService,
  SecuredLocationList,
} from '../location';
import {
  CreateOrganization,
  Organization,
  OrganizationListInput,
  OrganizationListOutput,
  UpdateOrganization,
} from './dto';
import { OrganizationRepository } from './organization.repository';

@Injectable()
export class OrganizationService {
  constructor(
    @Logger('org:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly locationService: LocationService,
    private readonly repo: OrganizationRepository
  ) {}

  async create(
    input: CreateOrganization,
    session: Session
  ): Promise<Organization> {
    await this.authorizationService.checkPower(
      Powers.CreateOrganization,
      session
    );

    if (!(await this.repo.isUnique(input.name))) {
      throw new DuplicateException(
        'organization.name',
        'Organization with this name already exists'
      );
    }

    const result = await this.repo.create(input, session);

    if (!result) {
      throw new ServerException('failed to create default org');
    }

    const id = result.id;

    this.logger.debug(`organization created`, { id });

    return await this.readOne(id, session);
  }

  @HandleIdLookup(Organization)
  async readOne(
    orgId: ID,
    session: Session,
    _view?: ObjectView
  ): Promise<Organization> {
    this.logger.debug(`Read Organization`, {
      id: orgId,
      userId: session.userId,
    });

    const result = await this.repo.readOne(orgId, session);
    return await this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const organizations = await this.repo.readMany(ids, session);
    return await Promise.all(
      organizations.map((dto) => this.secure(dto, session))
    );
  }

  private async secure(
    dto: UnsecuredDto<Organization>,
    session: Session
  ): Promise<Organization> {
    const securedProps = await this.authorizationService.secureProperties(
      Organization,
      dto,
      session
    );

    return {
      ...dto,
      ...securedProps,
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
    };
  }

  async update(
    input: UpdateOrganization,
    session: Session
  ): Promise<Organization> {
    const organization = await this.readOne(input.id, session);

    const changes = this.repo.getActualChanges(organization, input);

    await this.authorizationService.verifyCanEditChanges(
      Organization,
      organization,
      changes
    );

    return await this.repo.updateProperties(organization, changes);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    if (!object) {
      throw new NotFoundException('Could not find Organization');
    }

    const canDelete = await this.repo.checkDeletePermission(id, session);

    if (!canDelete)
      throw new UnauthorizedException(
        'You do not have the permission to delete this Organization'
      );

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      this.logger.error('Failed to delete', { id, exception });
      throw new ServerException('Failed to delete', exception);
    }

    this.logger.debug(`deleted organization with id`, { id });
  }

  async list(
    input: OrganizationListInput,
    session: Session
  ): Promise<OrganizationListOutput> {
    const limited = (await this.authorizationService.canList(
      Organization,
      session
    ))
      ? // --- need a sensitivity mapping for global because several roles have a global and/or project sensitivity access for nearly all props.
        {
          ...(await this.authorizationService.getListRoleSensitivityMapping(
            Organization,
            'global'
          )),
          ...(await this.authorizationService.getListRoleSensitivityMapping(
            Organization,
            'project'
          )),
        }
      : await this.authorizationService.getListRoleSensitivityMapping(
          Organization
        );

    const results = await this.repo.list(input, session, limited);
    return await mapListResults(results!, (dto) => this.secure(dto, session));
  }

  async addLocation(
    organizationId: ID,
    locationId: ID,
    _session: Session
  ): Promise<void> {
    try {
      await this.locationService.addLocationToNode(
        'Organization',
        organizationId,
        'locations',
        locationId
      );
    } catch (e) {
      throw new ServerException('Could not add location to organization', e);
    }
  }

  async removeLocation(
    organizationId: ID,
    locationId: ID,
    _session: Session
  ): Promise<void> {
    try {
      await this.locationService.removeLocationFromNode(
        'Organization',
        organizationId,
        'locations',
        locationId
      );
    } catch (e) {
      throw new ServerException(
        'Could not remove location from organization',
        e
      );
    }
  }

  async listLocations(
    organization: Organization,
    input: LocationListInput,
    session: Session
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationForResource(
      Organization,
      organization,
      'locations',
      input,
      session
    );
  }
}
