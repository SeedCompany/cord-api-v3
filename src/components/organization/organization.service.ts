import { Injectable } from '@nestjs/common';
import {
  type ID,
  type ObjectView,
  ServerException,
  type UnsecuredDto,
} from '~/common';
import { HandleIdLookup } from '~/core';
import { Privileges } from '../authorization';
import { LocationService } from '../location';
import {
  type LocationListInput,
  type SecuredLocationList,
} from '../location/dto';
import {
  type CreateOrganization,
  Organization,
  type OrganizationListInput,
  type OrganizationListOutput,
  type UpdateOrganization,
} from './dto';
import { OrganizationRepository } from './organization.repository';

@Injectable()
export class OrganizationService {
  constructor(
    private readonly privileges: Privileges,
    private readonly locationService: LocationService,
    private readonly repo: OrganizationRepository,
  ) {}

  async create(input: CreateOrganization): Promise<Organization> {
    // if (input.joinedAlliances && input.joinedAlliances.length > 0) {

    // }
    const created = await this.repo.create(input);

    this.privileges.for(Organization, created).verifyCan('create');

    return this.secure(created);
  }

  @HandleIdLookup(Organization)
  async readOne(orgId: ID, _view?: ObjectView): Promise<Organization> {
    const result = await this.repo.readOne(orgId);
    return this.secure(result);
  }

  async readMany(ids: readonly ID[]) {
    const organizations = await this.repo.readMany(ids);
    return organizations.map((dto) => this.secure(dto));
  }

  private secure(dto: UnsecuredDto<Organization>): Organization {
    return this.privileges.for(Organization).secure(dto);
  }

  async update(input: UpdateOrganization): Promise<Organization> {
    const organization = await this.readOne(input.id);

    const changes = this.repo.getActualChanges(organization, input);

    this.privileges.for(Organization, organization).verifyChanges(changes);

    const updated = await this.repo.update({ id: input.id, ...changes });

    return this.secure(updated);
  }

  async delete(id: ID): Promise<void> {
    const object = await this.readOne(id);

    this.privileges.for(Organization, object).verifyCan('delete');

    try {
      await this.repo.deleteNode(object);
    } catch (exception) {
      throw new ServerException('Failed to delete', exception);
    }
  }

  async list(input: OrganizationListInput): Promise<OrganizationListOutput> {
    const results = await this.repo.list(input);
    return {
      ...results,
      items: results.items.map((dto) => this.secure(dto)),
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
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationForResource(
      this.privileges.for(Organization, organization).forEdge('locations'),
      organization,
      input,
    );
  }
}
