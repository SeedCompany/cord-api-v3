import { Injectable } from '@nestjs/common';
import { isNil, omitBy } from 'lodash';
import {
  ID,
  MaybeUnsecuredInstance,
  NotFoundException,
  PaginatedListType,
  PublicOf,
  ResourceShape,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { Pg } from '../../core';
import { ChangesOf, DbChanges } from '../../core/database/changes';
import { BaseNode } from '../../core/database/results';
import { AuthSensitivityMapping } from '../authorization/authorization.service';
import { CreatePartner, Partner, PartnerListInput, UpdatePartner } from './dto';
import { PartnerRepository } from './partner.repository';

@Injectable()
export class PgPartnerRepository implements PublicOf<PartnerRepository> {
  constructor(private readonly pg: Pg) {}

  async create(input: CreatePartner, _session: Session): Promise<ID> {
    const [{ id }] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.partners(
          common_organizations_id, active, financial_reporting_types, 
          is_innovations_client, pmc_entity_code, point_of_contact_people_id, 
          types, address, created_by_admin_people_id, modified_by_admin_people_id, 
          owning_person_admin_people_id, owning_group_admin_groups_id)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [
        input.organizationId,
        input.active,
        input.financialReportingTypes,
        input.globalInnovationsClient,
        input.pmcEntityCode,
        input.pointOfContactId,
        input.types,
        input.address,
      ]
    );

    if (!id) {
      throw new ServerException('Failed to create partner');
    }

    return id;
  }

  async readOne(id: ID, _session?: Session): Promise<UnsecuredDto<Partner>> {
    const rows = await this.pg.query<UnsecuredDto<Partner>>(
      `
      SELECT 
          id, common_organizations_id as "organization", point_of_contact_people_id as "pointOfContact",
          types, financial_reporting_types as "financialReportingTypes", pmc_entity_code as "pmcEntityCode",
          is_innovations_client as "globalInnovationsClient", active, address, modified_at as "modifiedAt",
          created_at as "createdAt"
      FROM sc.partners
      WHERE id = $1;
      `,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException(`Could not find partner ${id}`);
    }

    return rows[0];
  }

  async readMany(
    ids: readonly ID[],
    _session: Session
  ): Promise<ReadonlyArray<UnsecuredDto<Partner>>> {
    const rows = await this.pg.query<UnsecuredDto<Partner>>(
      `
      SELECT
          id, common_organizations_id as "organization", point_of_contact_people_id as "pointOfContact",
          types, financial_reporting_types as "financialReportingTypes", pmc_entity_code as "pmcEntityCode",
          is_innovations_client as "globalInnovationsClient", active, address, modified_at as "modifiedAt",
          created_at as "createdAt"
      FROM sc.partners
      WHERE id = ANY($1::text[]);
      `,
      [ids]
    );

    return rows;
  }

  async updatePointOfContact(
    id: ID,
    user: ID,
    _session: Session
  ): Promise<void> {
    await this.pg.query(
      `
      UPDATE sc.partners SET point_of_contact = $1 WHERE id = $2;
      `,
      [user, id]
    );
  }

  async list(
    input: PartnerListInput,
    _session: Session,
    _limitedScope?: AuthSensitivityMapping
  ): Promise<PaginatedListType<UnsecuredDto<Partner>>> {
    // TODO: Match AuthSensitivityMapping and filters
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      `
      SELECT count(*)
      FROM sc.partners;
      `
    );

    const rows = await this.pg.query<UnsecuredDto<Partner>>(
      `
      SELECT
          id, common_organizations_id as "organization", point_of_contact_people_id as "pointOfContact",
          types, financial_reporting_types as "financialReportingTypes", pmc_entity_code as "pmcEntityCode",
          is_innovations_client as "globalInnovationsClient", active, address, modified_at as "modifiedAt",
          created_at as "createdAt"
      FROM sc.partners
      ORDER BY created_at ${input.order} 
      LIMIT ${limit ?? 25} OFFSET ${offset ?? 10};
      `
    );

    const partnerList: PaginatedListType<UnsecuredDto<Partner>> = {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };

    return partnerList;
  }

  async update(input: UpdatePartner) {
    const { id, ...rest } = input;
    const changes = omitBy(rest, isNil);
    const updates = Object.entries(changes)
      .map(([key, value]) => {
        const label = key
          .split(/(?=[A-Z])/)
          .join('_')
          .toLowerCase();

        return label === 'point_of_contact_id'
          ? `point_of_contact_people_id = (SELECT id FROM admin.people WHERE id = '${
              value as string
            }')`
          : label === 'global_innovations_client'
          ? `is_innovations_client = ${value as string}`
          : label === 'types'
          ? `types = ARRAY['${
              value.join("','") as string
            }']::sc.partner_types[]`
          : label === 'financial_reporting_types'
          ? `financial_reporting_types = ARRAY['${
              value.join("','") as string
            }']::sc.financial_reporting_types[]`
          : `${label} = '${value as string}'`;
      })
      .join(', ');

    await this.pg.query(
      `
      UPDATE sc.partners SET ${updates}, modified_at = CURRENT_TIMESTAMP,
      modified_by_admin_people_id = (SELECT admin_people_id FROM admin.tokens WHERE token = 'public')
      WHERE id = $1;
      `,
      [id]
    );
  }

  async delete(id: ID) {
    await this.pg.query('DELETE FROM sc.partners WHERE id = $1', [id]);
  }

  async partnerIdByOrg(organizationId: ID): Promise<ID | undefined> {
    const id = await this.pg.query<ID>(
      `SELECT id FROM sc.partners WHERE common_organizations_id = $1;`,
      [organizationId]
    );

    return id[0];
  }
  getActualChanges: <
    TResource extends MaybeUnsecuredInstance<typeof Partner>,
    Changes extends ChangesOf<TResource>
  >(
    existingObject: TResource,
    changes: Changes & Record<any, any>
  ) => Partial<any>;
  isUnique(_value: string, _label?: string): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  getBaseNode(
    _id: ID,
    _label?: string | ResourceShape<any>
  ): Promise<BaseNode | undefined> {
    throw new Error('Method not implemented.');
  }
  updateProperties<
    TObject extends Partial<MaybeUnsecuredInstance<typeof Partner>> & { id: ID }
  >(
    _object: TObject,
    _changes: DbChanges<Partner>,
    _changeset?: ID
  ): Promise<TObject> {
    throw new Error('Method not implemented.');
  }
  updateRelation(
    _relationName: string,
    _otherLabel: string,
    _id: ID,
    _otherId: ID | null
  ): Promise<void> {
    throw new Error('Method not implemented.');
  }
  checkDeletePermission(_id: ID, _session: Session | ID): Promise<boolean> {
    throw new Error('Method not implemented.');
  }
  deleteNode(_objectOrId: ID | { id: ID }, _changeset?: ID): Promise<void> {
    throw new Error('Method not implemented.');
  }
}
