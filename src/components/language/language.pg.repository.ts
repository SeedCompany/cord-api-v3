import { Injectable } from '@nestjs/common';
import { Query } from 'cypher-query-builder';
import { isEmpty, isNil, omitBy } from 'lodash';
import {
  ID,
  MaybeUnsecuredInstance,
  NotFoundException,
  ObjectView,
  PaginatedListType,
  PublicOf,
  ResourceShape,
  Session,
  UnsecuredDto,
} from '../../common';
import { Pg } from '../../core';
import { ChangesOf, DbChanges } from '../../core/database/changes';
import { BaseNode } from '../../core/database/results';
import { AuthSensitivityMapping } from '../authorization/authorization.service';
import {
  CreateLanguage,
  Language,
  LanguageListInput,
  UpdateLanguage,
} from './dto';
import { LanguageRepository } from './language.repository';

@Injectable()
export class PgLanguageRepository implements PublicOf<LanguageRepository> {
  constructor(private readonly pg: Pg) {}

  async create(
    input: CreateLanguage,
    ethnologueId: ID,
    _session: Session
  ): Promise<{ id: ID } | undefined> {
    const [id] = await this.pg.query<{ id: ID }>(
      `
      INSERT INTO sc.languages(ethnologue, name, display_name, display_name_pronunciation,
                                tags, is_dialect, is_sign_language, is_least_of_these, least_of_these_reason,
                                population_override, registry_of_dialects_code, sensitivity, sign_language_code,
                                sponsor_estimated_end_date, created_by, modified_by, owning_person, owning_group)
      VALUES ((SELECT id FROM sc.ethnologue WHERE id = $1), $2, $3, $4, $5::text[], $6, $7, $8, $9, $10, $11, $12, $13, $14,   
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT person FROM admin.tokens WHERE token = 'public'), 
          (SELECT id FROM admin.groups WHERE  name = 'Administrators'))
    `,
      [
        ethnologueId,
        input.name,
        input.displayName,
        input.displayNamePronunciation,
        input.tags,
        input.isDialect,
        input.isSignLanguage,
        input.leastOfThese,
        input.leastOfTheseReason,
        input.populationOverride,
        input.registryOfDialectsCode,
        input.sensitivity,
        input.signLanguageCode,
        input.sponsorEstimatedEndDate,
      ]
    );

    return id;
  }

  async readOne(
    id: ID,
    _session: Session,
    _view?: ObjectView | undefined
  ): Promise<UnsecuredDto<Language>> {
    const rows = await this.pg.query<UnsecuredDto<Language>>(
      `
      SELECT id, name, display_name as "displayName", sensitivity,
            display_name_pronunciation as "displayNamePronunciation", 
            is_dialect as "isDialect", is_sign_language as "isSignLanguage",
            is_least_of_these as "leastOfThese", least_of_these_reason as "leastOfTheseReason",
            sponsor_estimated_end_date as "sponsorEstimatedEndDate", sign_language_code as "signLanguageCode",
            registry_of_dialects_code as "registryOfDialectsCode", population_override as "populationOverride",
            tags, created_at as "createdAt"
      FROM sc.languages
      WHERE id = $1;
      `,
      [id]
    );

    if (!rows[0]) {
      throw new NotFoundException(`Could not find language: ${id}`);
    }

    return rows[0];
  }

  async readMany(
    ids: readonly ID[],
    _session: Session,
    _view?: ObjectView
  ): Promise<ReadonlyArray<UnsecuredDto<Language>>> {
    const rows = await this.pg.query<UnsecuredDto<Language>>(
      `
      SELECT id, name, display_name as "displayName", sensitivity,
            display_name_pronunciation as "displayNamePronunciation", 
            is_dialect as "isDialect", is_sign_language as "isSignLanguage",
            is_least_of_these as "leastOfThese", least_of_these_reason as "leastOfTheseReason",
            sponsor_estimated_end_date as "sponsorEstimatedEndDate", sign_language_code as "signLanguageCode",
            registry_of_dialects_code as "registryOfDialectsCode", population_override as "populationOverride",
            tags, created_at as "createdAt"
      FROM sc.languages
      WHERE id = ANY($1::text[]);
      `,
      [ids]
    );

    return rows;
  }

  async list(
    input: LanguageListInput,
    _session: Session,
    _limitedScope?: AuthSensitivityMapping
  ): Promise<PaginatedListType<UnsecuredDto<Language>>> {
    // TODO: Match AuthSensitivityMapping
    const limit = input.count;
    const offset = (input.page - 1) * input.count;

    const [{ count }] = await this.pg.query<{ count: string }>(
      'SELECT count(*) FROM sc.languages;'
    );

    const rows = await this.pg.query<UnsecuredDto<Language>>(
      `
      SELECT id, name, display_name as "displayName", sensitivity,
            display_name_pronunciation as "displayNamePronunciation", 
            is_dialect as "isDialect", is_sign_language as "isSignLanguage",
            is_least_of_these as "leastOfThese", least_of_these_reason as "leastOfTheseReason",
            sponsor_estimated_end_date as "sponsorEstimatedEndDate", sign_language_code as "signLanguageCode",
            registry_of_dialects_code as "registryOfDialectsCode", population_override as "populationOverride",
            tags, created_at as "createdAt"
      FROM sc.languages
      ORDER BY ${input.sort} ${input.order} 
      LIMIT ${limit ?? 10} OFFSET ${offset ?? 5};
      `
    );

    const languageList: PaginatedListType<UnsecuredDto<Language>> = {
      items: rows,
      total: +count,
      hasMore: rows.length < +count,
    };

    return languageList;
  }

  async update(input: UpdateLanguage) {
    const { id, ...rest } = input;
    const changes = omitBy(rest, isNil);

    if (isEmpty(changes)) {
      return;
    }

    const updates = Object.entries(changes)
      .map(([key, value]) => {
        const label = key
          .split(/(?=[A-Z])/)
          .join('_')
          .toLowerCase();

        return label === 'least_of_these'
          ? `is_least_of_these = ${value as string}`
          : label === 'tags'
          ? `tags = ARRAY['${value.join("','") as string}']`
          : `${label} = '${value as string}'`;
      })
      .join(', ');

    await this.pg.query(
      `
      UPDATE sc.languages SET ${updates}, modified_at = CURRENT_TIMESTAMP,
      modified_by = (SELECT person FROM admin.tokens WHERE token = 'public')
      WHERE id = $1
      RETURNING id;
      `,
      [id]
    );
  }

  async delete(id: ID) {
    await this.pg.query('DELETE FROM sc.languages WHERE id = $1', [id]);
  }

  async isUnique(value: string, _label?: string): Promise<boolean> {
    const [{ exists }] = await this.pg.query<{ exists: boolean }>(
      `
      SELECT EXISTS(SELECT name FROM sc.languages WHERE name = $1)
      `,
      [value]
    );

    return !exists;
  }

  listProjects(_language: Language): Promise<ReadonlyArray<{ id: ID }>> {
    throw new Error('Method not implemented.');
  }
  sponsorStartDate(
    _language: Language
  ): Promise<{ engagementIds: ID[] } | undefined> {
    throw new Error('Method not implemented.');
  }
  verifyExternalFirstScripture(_id: ID): Promise<unknown> {
    throw new Error('Method not implemented.');
  }
  isPresetInventory(): (query: Query) => Query {
    throw new Error('Method not implemented.');
  }
  getActualChanges: <
    TResource extends MaybeUnsecuredInstance<typeof Language>,
    Changes extends ChangesOf<TResource>
  >(
    existingObject: TResource,
    changes: Changes & Record<any, any>
  ) => Partial<any>;

  getBaseNode(
    _id: ID,
    _label?: string | ResourceShape<any>
  ): Promise<BaseNode | undefined> {
    throw new Error('Method not implemented.');
  }

  updateProperties<
    TObject extends Partial<MaybeUnsecuredInstance<typeof Language>> & {
      id: ID;
    }
  >(
    _object: TObject,
    _changes: DbChanges<Language>,
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
