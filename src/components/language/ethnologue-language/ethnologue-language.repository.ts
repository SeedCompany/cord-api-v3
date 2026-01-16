import { Injectable } from '@nestjs/common';
import {
  CreationFailed,
  type ID,
  NotFoundException,
  ReadAfterCreationFailed,
  ServerException,
} from '~/common';
import { DtoRepository } from '~/core/database';
import { createNode } from '~/core/database/query';
import {
  type CreateEthnologueLanguage,
  EthnologueLanguage,
  type UpdateEthnologueLanguage,
} from '../dto';

@Injectable()
export class EthnologueLanguageRepository extends DtoRepository(
  EthnologueLanguage,
) {
  async create(input: CreateEthnologueLanguage & { languageId: ID }) {
    const initialProps = {
      code: input.code,
      provisionalCode: input.provisionalCode,
      name: input.name,
      population: input.population,
    };

    const query = this.db
      .query()
      .apply(await createNode(EthnologueLanguage, { initialProps }))
      .return<{ id: ID }>('node.id as id');

    let result;
    try {
      result = await query.first();
    } catch (e) {
      throw new CreationFailed(EthnologueLanguage, { cause: e });
    }

    if (!result) {
      throw new CreationFailed(EthnologueLanguage);
    }

    return await this.readOne(result.id).catch((e) => {
      throw e instanceof NotFoundException
        ? new ReadAfterCreationFailed(EthnologueLanguage)
        : e;
    });
  }

  async update(changes: UpdateEthnologueLanguage & { id: ID }) {
    const { id, ...simpleChanges } = changes;

    try {
      await this.updateProperties({ id }, simpleChanges);
    } catch (exception) {
      throw new ServerException(
        'Failed to update ethnologue language',
        exception,
      );
    }

    return undefined as unknown;
  }
}
