import { Injectable } from '@nestjs/common';
import { isEmpty, isNil, omitBy } from 'lodash';
import {
  ID,
  MaybeUnsecuredInstance,
  PublicOf,
  ResourceShape,
  Session,
  UnsecuredDto,
} from '../../../common';
import { Pg } from '../../../core';
import { ChangesOf, DbChanges } from '../../../core/database/changes';
import { BaseNode } from '../../../core/database/results';
import {
  CreateEthnologueLanguage,
  EthnologueLanguage,
  UpdateEthnologueLanguage,
} from '../dto';
import { EthnologueLanguageRepository } from './ethnologue-language.repository';

@Injectable()
export class PgEthnologueLanguageRepository
  implements PublicOf<EthnologueLanguageRepository>
{
  constructor(private readonly pg: Pg) {}

  async create(
    input: CreateEthnologueLanguage,
    _session: Session
  ): Promise<{ id: ID } | undefined> {
    const [id] = await this.pg.query<{ id: ID }>(
      `
      WITH common_id AS (INSERT INTO common.languages(created_by, modified_by, owning_person, owning_group) 
            VALUES((SELECT person FROM admin.tokens WHERE token = 'public'), 
                    (SELECT person FROM admin.tokens WHERE token = 'public'), 
                    (SELECT person FROM admin.tokens WHERE token = 'public'), 
                    (SELECT id FROM admin.groups WHERE  name = 'Administrators')) 
            RETURNING id as common_id),   
      sil_index AS (INSERT INTO sil.language_index(id, lang, country, name_type, name, created_by, modified_by, owning_person, owning_group)
            VALUES ((SELECT common_id FROM common_id), 'asd', 'NG', 'L','testname', (SELECT person FROM admin.tokens WHERE token = 'public'), 
                    (SELECT person FROM admin.tokens WHERE token = 'public'), 
                    (SELECT person FROM admin.tokens WHERE token = 'public'), 
                    (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
            RETURNING id as sil_id)				   
      INSERT INTO sc.ethnologue(language_index, code, language_name, population, provisional_code, created_by, modified_by, owning_person, owning_group)
      VALUES ((SELECT sil_id FROM sil_index), $1, $2, $3, $4, (SELECT person FROM admin.tokens WHERE token = 'public'), 
              (SELECT person FROM admin.tokens WHERE token = 'public'), 
              (SELECT person FROM admin.tokens WHERE token = 'public'), 
              (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
      RETURNING id;
    `,
      [input.code, input.name, input.population, input.provisionalCode]
    );

    return id;
  }

  async readOne(id: ID): Promise<UnsecuredDto<EthnologueLanguage>> {
    const rows = await this.pg.query<UnsecuredDto<EthnologueLanguage>>(
      `
      SELECT id, code, language_name as name, population, provisional_code as provisionalCode
      FROM sc.ethnologue
      WHERE id = $1;
      `,
      [id]
    );

    return rows[0];
  }

  readMany(
    _ids: readonly ID[]
  ): Promise<ReadonlyArray<UnsecuredDto<EthnologueLanguage>>> {
    throw new Error('Method not implemented.');
  }

  async update(id: ID, input: UpdateEthnologueLanguage) {
    const changes = omitBy(input, isNil);

    if (isEmpty(changes)) {
      return;
    }

    const updates = Object.entries(changes)
      .map(([key, value]) => {
        const label = key
          .split(/(?=[A-Z])/)
          .join('_')
          .toLowerCase();

        return label === 'name'
          ? `language_name = '${value as string}'`
          : `${label} = '${value as string}'`;
      })
      .join(', ');

    await this.pg.query(
      `
      UPDATE sc.ethnologue SET ${updates}, modified_at = CURRENT_TIMESTAMP, 
      modified_by = (SELECT person FROM admin.tokens WHERE token = 'public')
      WHERE id = $1
      RETURNING id;
      `,
      [id]
    );
  }

  async delete(id: ID) {
    await this.pg.query('DELETE FROM sc.ethnologue WHERE id = $1', [id]);
  }

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
    TObject extends Partial<
      MaybeUnsecuredInstance<typeof EthnologueLanguage>
    > & { id: ID }
  >(
    _object: TObject,
    _changes: DbChanges<EthnologueLanguage>,
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

  getActualChanges: <
    TResource extends MaybeUnsecuredInstance<typeof EthnologueLanguage>,
    Changes extends ChangesOf<TResource>
  >(
    existingObject: TResource,
    changes: Changes & Record<any, any>
  ) => Partial<any>;
}
