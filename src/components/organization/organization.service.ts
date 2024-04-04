import { Injectable } from '@nestjs/common';
import {
  ID,
  ObjectView,
  ServerException,
  Session,
  UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core';
import { Privileges } from '../authorization';
import { LocationService } from '../location';
import { LocationListInput, SecuredLocationList } from '../location/dto';
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
    private readonly privileges: Privileges,
    private readonly locationService: LocationService,
    private readonly repo: OrganizationRepository,
  ) {}

  async create(
    input: CreateOrganization,
    session: Session,
  ): Promise<Organization> {
    const created = await this.repo.create(input, session);

    this.privileges.for(session, Organization, created).verifyCan('create');

    return this.secure(created, session);
  }

  @HandleIdLookup(Organization)
  async readOne(
    orgId: ID,
    session: Session,
    _view?: ObjectView,
  ): Promise<Organization> {
    const result = await this.repo.readOne(orgId, session);
    return this.secure(result, session);
  }

  async readMany(ids: readonly ID[], session: Session) {
    const organizations = await this.repo.readMany(ids, session);
    return organizations.map((dto) => this.secure(dto, session));
  }

  private secure(
    dto: UnsecuredDto<Organization>,
    session: Session,
  ): Organization {
    return this.privileges.for(session, Organization).secure(dto);
  }

  async update(
    input: UpdateOrganization,
    session: Session,
  ): Promise<Organization> {
    const organization = await this.readOne(input.id, session);

    const changes = this.repo.getActualChanges(organization, input);

    this.privileges
      .for(session, Organization, organization)
      .verifyChanges(changes);

    const updated = await this.repo.update(
      { id: input.id, ...changes },
      session,
    );

    return this.secure(updated, session);
  }

  async delete(id: ID, session: Session): Promise<void> {
    const object = await this.readOne(id, session);

    this.privileges.for(session, Organization, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(
    input: OrganizationListInput,
    session: Session,
  ): Promise<OrganizationListOutput> {
    const results = await this.repo.list(input, session);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto, session)),
    };
  }

  async addLocation(organizationId: ID, locationId: ID): Promise<void> {
    try {
      await this.locationService.addLocationToNode(
        'Organization',
        organizationId,
        'locations',
        locationId,
      );
    } catch (e) {
      throw new ServerException('Could not add location to organization', e);
    }
  }

  async removeLocation(organizationId: ID, locationId: ID): Promise<void> {
    try {
      await this.locationService.removeLocationFromNode(
        'Organization',
        organizationId,
        'locations',
        locationId,
      );
    } catch (e) {
      throw new ServerException(
        'Could not remove location from organization',
        e,
      );
    }
  }

  async listLocations(
    organization: Organization,
    input: LocationListInput,
    session: Session,
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationForResource(
      this.privileges
        .for(session, Organization, organization)
        .forEdge('locations'),
      organization,
      input,
    );
  }
}
