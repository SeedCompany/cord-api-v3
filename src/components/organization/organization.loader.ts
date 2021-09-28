import { Injectable, Scope } from '@nestjs/common';
import { ID } from '../../common';
import { OrderedNestDataLoader } from '../../core';
import { Organization } from './dto';
import { OrganizationService } from './organization.service';

@Injectable({ scope: Scope.REQUEST })
export class OrganizationLoader extends OrderedNestDataLoader<Organization> {
  constructor(private readonly organizations: OrganizationService) {
    super();
  }

  async loadMany(ids: readonly ID[]) {
    return await this.organizations.readMany(ids, this.session);
  }
}
