import { Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import { ConditionalKeys } from 'type-fest';
import { Language as DbLanguage } from '~/core/edgedb/schema';
import {
  CalendarDate,
  DuplicateException,
  ID,
  NotFoundException,
  Order,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../common';
import { e, EdgeDb, isExclusivityViolation } from '../../core/edgedb';
import { Project } from '../project/dto';
import { CreateLanguage, Language, LanguageListInput } from './dto';
import { LanguageRepository } from './language.repository';

const hydrate = e.shape(e.Language, (language) => ({
  ...language['*'],
  effectiveSensitivity: e.cast(e.Sensitivity, 'High'), //TODO: stubbed
  presetInventory: e.bool(false), //TODO: stubbed
  ethnologue: {
    ...e.Language['*'],
    code: true,
    provisionalCode: true,
  },
}));

@Injectable()
export class LanguageEdgedbRepository extends LanguageRepository {
  constructor(private readonly edgedb: EdgeDb) {
    super();
  }

  async readOne(id: ID, _session: Session | ID) {
    const query = e.select(e.Language, (language) => ({
      ...hydrate(language),
      filter_single: { id },
    }));
    const language = await query.run(this.edgedb);

    if (!language) {
      throw new NotFoundException('Could not find language');
    }

    return language as UnsecuredDto<Language>;
  }

  async readMany(ids: readonly ID[], _session: Session | ID) {
    const query = e.params({ ids: e.array(e.uuid) }, ({ ids }) =>
      e.select(e.Language, (language) => ({
        ...hydrate(language),
        filter: e.op(language.id, 'in', e.array_unpack(ids)),
      })),
    );
    const languages = await query.run(this.edgedb, { ids });
    return languages as Array<UnsecuredDto<Language>>;
  }

  async list(input: LanguageListInput, _session: Session) {
    const sort = input.sort as Exclude<
      ConditionalKeys<DbLanguage, string | number | DateTime | CalendarDate>,
      'status'
    > &
      string;
    const query = e.select(e.Language, (language) => ({
      ...hydrate(language),
      //TODO filters
      order_by: {
        expression: (language as any)[sort], //TODO rework this any
        direction: input.order === Order.ASC ? e.ASC : e.DESC,
      },
      // TODO pagination
    }));
    const items = await query.run(this.edgedb);
    return {
      items: items as Array<UnsecuredDto<Language>>,
      total: items.length,
      hasMore: false,
    };
  }

  async create(input: CreateLanguage) {
    const query = e.insert(e.Language, {
      ...input,
      ethnologue: e.insert(e.Ethnologue.Language, { ...input.ethnologue }),
    });
    try {
      const language = await query.run(this.edgedb);
      return language;
    } catch (e) {
      if (isExclusivityViolation(e, 'registryOfDialectsCode')) {
        throw new DuplicateException(
          'language.registryOfDialectsCode',
          'Registry of Dialects Code is already in use',
          e,
        );
      }
      throw new ServerException('Failed to create language', e);
    }
  }

  async listProjects(language: Language) {
    const query = e.select(e.Language, (lang) => ({
      projects: lang.projects['*'],
      filter: e.op(language.id, '=', lang.id),
    }));
    const projects = await query.run(this.edgedb);
    return projects as unknown as Array<UnsecuredDto<Project>>; //TODO address the typing issue (hidden with uknown currently)
  }

  //TODO: finish class implementation...
}
