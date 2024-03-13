import { Injectable } from '@nestjs/common';
import { ID, PaginatedListType, PublicOf } from '~/common';
import { ChangesOf } from '~/core/database/changes';
import { e, RepoFor } from '~/core/edgedb';
import {
  CreateOrganization,
  Organization,
  OrganizationListInput,
  UpdateOrganization,
} from './dto';
import { OrganizationRepository } from './organization.repository';

@Injectable()
export class OrganizationEdgeDBRepository
  extends RepoFor(Organization, {
    hydrate: (organization) => organization['*'],
  }).customize((cls) => {
    return class extends cls {
      async create(input: CreateOrganization) {
        // TODO - figure out why this isn't working for me
        // return await this.defaults.create({
        //   ...input,
        //   projectContext: e.insert(e.Project.Context, {}),
        // });
        const created = e.insert(e.Organization, {
          ...input,
          projectContext: e.insert(e.Project.Context, {}),
        });
        const query = e.select(created, this.hydrate);
        return await this.db.run(query).then((org) => {
          return { id: org.id };
        });
      }
      async update(input: UpdateOrganization): Promise<Organization | null> {
        const updateInputs = Object.fromEntries(
          Object.entries(changes).filter(
            ([key, value]) =>
              value !== undefined && value !== null && key !== 'id',
          ),
        );
        // TODO - can't figure out scope here 🤔
        const updateOrganization = e.update(e.Organization, (scope) => ({
          filter_single: { id: existing.id },
          set: {
            ...updateInputs,
          },
        }));
        const query = e.select(updateOrganization, this.hydrate);
        // TODO - not sure how to fix TS here
        return await this.db.run(query).then((org) => org);
      }
      async list(
        input: OrganizationListInput,
      ): Promise<PaginatedListType<Organization>> {
        // thinking that this needs to use the project context
        // to somehow pass in the user?
        const user = e.select(e.Organization, () => ({
          filter_single: {},
        }));
        return [] as PaginatedListType<Organization>;
      }
    };
  })
  implements PublicOf<OrganizationRepository> {}
