import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { range } from 'lodash';
import {
  DuplicateException,
  ID,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
} from '../../common';
import { ConfigService, ILogger, Logger, OnIndex } from '../../core';
import {
  parseBaseNodeProperties,
  runListQuery,
} from '../../core/database/results';
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
import { DbOrganization } from './model';
import { OrganizationRepository } from './organization.repository';

@Injectable()
export class OrganizationService {
  constructor(
    @Logger('org:service') private readonly logger: ILogger,
    private readonly config: ConfigService,
    // private readonly db: DatabaseService,
    @Inject(forwardRef(() => AuthorizationService))
    private readonly authorizationService: AuthorizationService,
    private readonly locationService: LocationService,
    private readonly repo: OrganizationRepository
  ) {}

  @OnIndex()
  async createIndexes() {
    return [
      'CREATE CONSTRAINT ON (n:Organization) ASSERT EXISTS(n.id)',
      'CREATE CONSTRAINT ON (n:Organization) ASSERT n.id IS UNIQUE',
      'CREATE CONSTRAINT ON (n:Organization) ASSERT EXISTS(n.createdAt)',

      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.active)',
      'CREATE CONSTRAINT ON ()-[r:name]-() ASSERT EXISTS(r.createdAt)',

      'CREATE CONSTRAINT ON (n:OrgName) ASSERT EXISTS(n.value)',
      'CREATE CONSTRAINT ON (n:OrgName) ASSERT n.value IS UNIQUE',
    ];
  }

  async create(
    input: CreateOrganization,
    session: Session
  ): Promise<Organization> {
    await this.authorizationService.checkPower(
      Powers.CreateOrganization,
      session
    );

    const checkOrg = await this.repo.checkOrg(input.name);

    if (checkOrg) {
      throw new DuplicateException(
        'organization.name',
        'Organization with this name already exists'
      );
    }

    const publicSecurityId = this.config.publicSecurityGroup.id;

    const result = await this.repo.create(input, session, publicSecurityId);

    if (!result) {
      throw new ServerException('failed to create default org');
    }

    const dbOrganization = new DbOrganization();
    await this.authorizationService.processNewBaseNode(
      dbOrganization,
      result.id,
      session.userId
    );

    const id = result.id;

    this.logger.debug(`organization created`, { id });

    return await this.readOne(id, session);
  }

  async readOne(orgId: ID, session: Session): Promise<Organization> {
    this.logger.debug(`Read Organization`, {
      id: orgId,
      userId: session.userId,
    });

    const result = await this.repo.readOne(orgId, session);

    if (!result) {
      throw new NotFoundException(
        'Could not find organization',
        'organization.id'
      );
    }

    const secured = await this.authorizationService.secureProperties(
      Organization,
      result.propList,
      session
    );

    return {
      ...parseBaseNodeProperties(result.node),
      ...secured,
      canDelete: await this.repo.checkDeletePermission(orgId, session),
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
    { filter, ...input }: OrganizationListInput,
    session: Session
  ): Promise<OrganizationListOutput> {
    const query = this.repo.list({ filter, ...input }, session);

    return await runListQuery(query, input, (id) => this.readOne(id, session));
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
    organizationId: ID,
    input: LocationListInput,
    session: Session
  ): Promise<SecuredLocationList> {
    return await this.locationService.listLocationsFromNode(
      'Organization',
      organizationId,
      'locations',
      input,
      session
    );
  }

  async checkAllOrgs(session: Session): Promise<boolean> {
    try {
      const result = await this.repo.checkAllOrgs(session);

      const orgCount = result?.orgCount;

      for (const i of range(orgCount)) {
        const isGood = await this.pullOrg(i, session);
        if (!isGood) {
          return false;
        }
      }
    } catch (e) {
      this.logger.error('Checks failed', { exception: e });
    }

    return true;
  }

  private async pullOrg(index: number, session: Session): Promise<boolean> {
    const result = await this.repo.pullOrg(index);

    const isGood = this.validateOrg({
      id: result?.id,
      createdAt: result?.createdAt,
      name: {
        value: result?.name,
        canRead: false,
        canEdit: false,
      },
      address: {
        value: result?.address,
        canRead: false,
        canEdit: false,
      },
      canDelete: await this.repo.checkDeletePermission(result?.id, session), // TODO
    });

    return isGood;
  }

  private validateOrg(org: Organization): boolean {
    // org has an id
    if (org.id === undefined || org.id === null) {
      this.logger.error('bad org id', org);
      return false;
    }
    // org has a name
    if (org.name.value === undefined || org.name.value === null) {
      this.logger.error('org has a bad name', org);
      return false;
    }
    // created after 1990
    if (org.createdAt.year <= 1990) {
      this.logger.error('org has a bad createdAt: ', org);
      return false;
    }

    return true;
  }

  async checkOrganizationConsistency(session: Session): Promise<boolean> {
    const organizations = await this.repo.getOrganizations(session);

    return (
      (
        await Promise.all(
          organizations.map(async (organization) => {
            return await this.repo.hasProperties(session, organization.id);
          })
        )
      ).every((n) => n) &&
      (
        await Promise.all(
          organizations.map(async (organization) => {
            return await this.repo.isUniqueProperties(session, organization.id);
          })
        )
      ).every((n) => n)
    );
  }
}
