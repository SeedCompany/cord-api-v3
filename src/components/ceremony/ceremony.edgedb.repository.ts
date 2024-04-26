import { Injectable } from '@nestjs/common';
import { PaginatedListType, PublicOf, UnsecuredDto } from '~/common';
import { DbTypeOf } from '~/core';
import { ChangesOf } from '~/core/database/changes';
import { castToEnum, RepoFor } from '~/core/edgedb';
import { CeremonyRepository } from './ceremony.repository';
import {
  Ceremony,
  CeremonyListInput,
  CeremonyType,
  CreateCeremony,
  UpdateCeremony,
} from './dto';

@Injectable()
export class CeremonyEdgeDBRepository
  extends RepoFor(Ceremony, {
    hydrate: (ceremony) => ({
      ...ceremony['*'],
      engagement: true,
      type: castToEnum(ceremony.__type__.name.slice(12, -8), CeremonyType),
    }),
  }).customize((cls, { defaults }) => {
    return class extends cls {
      static omit = [defaults.readOne, defaults.readMany];
      async create(input: CreateCeremony): Promise<any> {
        // EdgeDB creates these ceremonies in the process of creating the parent
        return;
      }
      async update(
        existing: DbTypeOf<Ceremony>,
        changes: ChangesOf<Ceremony, UpdateCeremony>,
      ): Promise<DbTypeOf<Ceremony>> {
        return await this.defaults.update({ existing, changes });
      }
      async list({
        filter,
        ...input
      }: CeremonyListInput): Promise<
        PaginatedListType<UnsecuredDto<Ceremony>>
      > {
        return await this.defaults.list({ filter, ...input });
      }
    };
  })
  implements PublicOf<CeremonyRepository> {}
