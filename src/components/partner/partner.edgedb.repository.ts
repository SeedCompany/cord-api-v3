import { Injectable } from '@nestjs/common';
import { ID, PaginatedListType, PublicOf, UnsecuredDto } from '~/common';
import { e, RepoFor } from '~/core/edgedb';
import { CreatePartner, Partner, UpdatePartner } from './dto';
import { PartnerRepository } from './partner.repository';

@Injectable()
export class PartnerEdgeDBRepository
  extends RepoFor(Partner, {
    hydrate: (p) => ({
      ...p['*'],
      sensitivity: true,
      organization: true,
      pointOfContact: true,
      languageOfWiderCommunication: true,
      fieldRegions: true,
      countries: true,
      languagesOfConsulting: true,
      scope: true,
      pinned: true,
    }),
  }).customize((cls) => {
    return class extends cls {
      async create(input: CreatePartner): Promise<ID> {
        if (!input.organizationId) {
          throw new Error('Organization Must be provided');
        }
        const pointOfContact = e.select(e.User, () => ({
          filter_single: { id: input.pointOfContactId! },
        }));
        const languageOfWiderCommunication = e.select(e.Language, () => ({
          filter_single: { id: input.languageOfWiderCommunicationId! },
        }));
        const organization = e.select(e.Organization, () => ({
          filter_single: { id: input.organizationId },
        }));
        const languageIds = input.languagesOfConsulting ?? [];
        const languagesOfConsulting = e.cast(
          e.Language,
          e.set(...languageIds.map((id) => e.uuid(id))),
        );
        const fieldRegionsIds = input.fieldRegions ?? [];
        const fieldRegions = e.cast(
          e.FieldRegion,
          e.set(...fieldRegionsIds.map((id) => e.uuid(id))),
        );
        const countries = e.cast(
          e.Location,
          e.set(...(input.countries ?? []).map((id) => e.uuid(id))),
        );
        // TODO - not sure on this how the project context works
        const projectContext: any = null;
        const created = e.insert(e.Partner, {
          id: undefined,
          name: `partner-${input.organizationId}`,
          active: !!input.active,
          globalInnovationsClient: !!input.globalInnovationsClient,
          pmcEntityCode: input.pmcEntityCode,
          types: input.types,
          financialReportingTypes: input.financialReportingTypes,
          pointOfContact,
          languageOfWiderCommunication,
          organization,
          languagesOfConsulting,
          fieldRegions,
          countries,
          projectContext,
        });
        const query = e.select(created, this.hydrate);
        return await this.db.run(query).then((partner) => partner.id);
      }

      async update(input: UpdatePartner): Promise<void> {
        const updateInputs = Object.fromEntries(
          Object.entries(input).filter(
            ([key, value]) => value !== undefined && value !== null,
          ),
        );
        const updatePartner = e.update(e.Partner, () => ({
          filter_single: { id: input.id },
          set: {
            ...updateInputs,
          },
        }));
        const query = e.select(updatePartner, this.hydrate);
        await this.db.run(query);
        return;
      }

      async list(
        input: any,
      ): Promise<PaginatedListType<UnsecuredDto<Partner>>> {
        return [] as any;
      }

      async readOne(input: any): Promise<any> {
        return;
      }

      async readMany(input: any): Promise<any> {
        return;
      }
    };
  })
  implements PublicOf<PartnerRepository>
{
  async partnerIdByOrg(organizationId: ID) {
    const organization = e.select(e.Organization, () => ({
      filter_single: { id: organizationId },
    }));
    const partner = e.select(e.Partner, () => ({
      filter_single: { organization },
    }));
    const result = await this.db.run(partner);
    return result?.id ?? undefined;
  }
}
