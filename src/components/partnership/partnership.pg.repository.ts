import { Injectable } from '@nestjs/common';
import { isNil, omitBy } from 'lodash';
import {
  generateId,
  ID,
  MaybeUnsecuredInstance,
  NotFoundException,
  ObjectView,
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
import {
  CreatePartnership,
  Partnership,
  PartnershipAgreementStatus,
  PartnershipListInput,
  UpdatePartnership,
} from './dto';
import { PartnershipRepository } from './partnership.repository';

@Injectable()
export class PgPartnershipRepository
  implements PublicOf<PartnershipRepository>
{
  constructor(private readonly pg: Pg) {}

  async create(
    input: CreatePartnership,
    _session?: Session,
    _changeset?: ID
  ): Promise<{ id: ID; mouId: ID; agreementId: ID }> {
    const mouId = await generateId();
    const agreementId = await generateId();

    const [{ id }] = await this.pg.query<{ id: ID }>(
      // TODO: Add mou and agreement files
      `
      INSERT INTO sc.partnerships(
          sc_projects_id, sc_partners_id, agreement_status, mou_status, mou_start_override, 
          mou_end_override, financial_reporting_type, types, is_primary, created_by_admin_people_id, 
          modified_by_admin_people_id, owning_person_admin_people_id, owning_group_admin_groups_id)
      VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
            (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
            (SELECT admin_people_id FROM admin.tokens WHERE token = 'public'), 
            (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
      `,
      [
        input.projectId,
        input.partnerId,
        input.agreementStatus || PartnershipAgreementStatus.NotAttached,
        input.mouStatus || PartnershipAgreementStatus.NotAttached,
        input.mouStartOverride,
        input.mouEndOverride,
        input.financialReportingType,
        input.types,
        input.primary,
      ]
    );

    if (!id) {
      throw new ServerException('Failed to create partnership');
    }

    return { id, mouId, agreementId };
  }

  async readOne(
    id: ID,
    _session?: Session,
    _view?: ObjectView | undefined
  ): Promise<UnsecuredDto<Partnership>> {
    const rows = await this.pg.query<UnsecuredDto<Partnership>>(
      `
      SELECT 
          id, sc_projects_id, sc_partners_id, agreement, agreement_status as "agreementStatus", 
          mou, mou_status as "mouStatus", mou_start as "mouStart", mou_end as "mouEnd", 
          mou_start_override as "mouStartOverride", mou_end_override as "mouEndOverride", 
          types, is_primary as "primary", financial_reporting_type as "financialReportingType", 
          created_at as "createdAt"
      FROM sc.partnerships
      WHERE id = $1;
      `,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException(`Could not find partnership ${id}`);
    }

    return rows[0];
  }

  async readMany(
    ids: readonly ID[],
    _session?: Session,
    _view?: ObjectView
  ): Promise<ReadonlyArray<UnsecuredDto<Partnership>>> {
    const rows = await this.pg.query<UnsecuredDto<Partnership>>(
      `
      SELECT 
          id, sc_projects_id, sc_partners_id, agreement, agreement_status as "agreementStatus", 
          mou, mou_status as "mouStatus", mou_start as "mouStart", mou_end as "mouEnd", 
          mou_start_override as "mouStartOverride", mou_end_override as "mouEndOverride", 
          types, is_primary as "primary", financial_reporting_type as "financialReportingType", 
          created_at as "createdAt"
      FROM sc.partnerships
      WHERE id = ANY($1::text[]);
      `,
      [ids]
    );

    return rows;
  }

  async list(
    input: PartnershipListInput,
    _session?: Session,
    _changeset?: ID,
    _limitedScope?: AuthSensitivityMapping
  ): Promise<PaginatedListType<ID>> {
    // TODO: Match AuthSensitivityMapping
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      `
      SELECT count(*)
      FROM sc.partnerships;
      `
    );

    const rows = await this.pg.query<ID>(
      `
      SELECT id
      FROM sc.partnerships
      ORDER BY created_at ${input.order} 
      LIMIT ${limit ?? 25} OFFSET ${offset ?? 10};
      `
    );

    const partnershipList: PaginatedListType<ID> = {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };

    return partnershipList;
  }

  async isFirstPartnership(projectId: ID, _changeset?: ID): Promise<boolean> {
    // TODO: Add changeset matching
    const [{ isFirst }] = await this.pg.query<{ isFirst: boolean }>(
      `
      SELECT count(id) = 1 as "isFirst" FROM sc.partnerships WHERE sc_projects_id = $1;
      `,
      [projectId]
    );

    return isFirst;
  }

  async isAnyOtherPartnerships(id: ID): Promise<boolean> {
    const rows = await this.pg.query<{ id: ID }>(
      `
      SELECT id 
      FROM sc.partnerships 
      WHERE sc_projects_id = (SELECT sc_projects_id FROM sc.partnerships WHERE id = $1) 
      AND id <> $1;
      `,
      [id]
    );

    return !!rows.length;
  }

  async removePrimaryFromOtherPartnerships(id: ID): Promise<void> {
    await this.pg.query(
      `
      UPDATE sc.partnerships SET is_primary = false
      WHERE sc_projects_id = (SELECT sc_projects_id FROM sc.partnerships WHERE id = $1) AND id <> $1;
      `,
      [id]
    );
  }

  async update(input: UpdatePartnership) {
    const { id, ...rest } = input;
    const changes = omitBy(rest, isNil);
    const updates = Object.entries(changes)
      .map(([key, value]) => {
        const label = key
          .split(/(?=[A-Z])/)
          .join('_')
          .toLowerCase();

        return label === 'primary'
          ? `is_primary = '${value as string}'`
          : label === 'types'
          ? `types = ARRAY['${
              value.join("','") as string
            }']::sc.partner_types[]`
          : `${label} = '${value as string}'`;
      })
      .join(', ');

    await this.pg.query(
      `
      UPDATE sc.partnerships SET ${updates}, modified_at = CURRENT_TIMESTAMP,
      modified_by_admin_people_id = (SELECT admin_people_id FROM admin.tokens WHERE token = 'public')
      WHERE id = $1;
      `,
      [id]
    );
  }

  verifyRelationshipEligibility(
    _projectId: ID,
    _partnerId: ID,
    _changeset?: ID
  ): Promise<{
    partner?: Node | undefined;
    project?: Node | undefined;
    partnership?: Node | undefined;
  }> {
    throw new Error('Method not implemented.');
  }
  getActualChanges: <
    TResource extends MaybeUnsecuredInstance<typeof Partnership>,
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
    TObject extends Partial<MaybeUnsecuredInstance<typeof Partnership>> & {
      id: ID;
    }
  >(
    _object: TObject,
    _changes: DbChanges<Partnership>,
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
