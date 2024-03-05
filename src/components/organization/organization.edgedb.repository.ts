import { Injectable } from '@nestjs/common';
import { PublicOf } from '~/common';
import { RepoFor } from '~/core/edgedb';
import { Organization } from './dto';
import { OrganizationRepository } from './organization.repository';

@Injectable()
export class OrganizationEdgeDBRepository
  extends RepoFor(Organization, {
    hydrate: (organization) => ({
      ...organization['*'],
      scope: true,
      sensitivity: true,
    }),
  }).withDefaults()
  implements PublicOf<OrganizationRepository> {}
