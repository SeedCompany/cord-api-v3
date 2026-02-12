import { Injectable } from '@nestjs/common';
import { type ID, type Sensitivity, type UnsecuredDto } from '~/common';
import { Privileges, withEffectiveSensitivity } from '../../authorization';
import {
  type CreateEthnologueLanguage,
  EthnologueLanguage,
  EthnologueLanguageUpdate,
  type UpdateEthnologueLanguage,
} from '../dto';
import { EthnologueLanguageRepository } from './ethnologue-language.repository';

@Injectable()
export class EthnologueLanguageService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: EthnologueLanguageRepository,
  ) {}

  async create(input: CreateEthnologueLanguage): Promise<ID> {
    this.privileges.for(EthnologueLanguage).verifyCan('create');

    //TODO - remove the passed in languageId after migration
    return (await this.repo.create({ languageId: 'temp' as ID, ...input })).id;
  }

  async readOne(id: ID, sensitivity: Sensitivity): Promise<EthnologueLanguage> {
    const dto = await this.repo.readOne(id);
    return this.secure(dto, sensitivity);
  }

  secure(dto: UnsecuredDto<EthnologueLanguage>, sensitivity: Sensitivity) {
    return {
      ...this.privileges
        .for(EthnologueLanguage)
        .secure(withEffectiveSensitivity(dto, sensitivity)),
      sensitivity,
    };
  }

  prepChanges(
    input: UpdateEthnologueLanguage | undefined,
    ethnologue: UnsecuredDto<EthnologueLanguage>,
    effectiveSensitivity: Sensitivity,
  ) {
    if (!input) {
      return undefined;
    }
    const changes = this.repo.getActualChanges(ethnologue, input);
    if (Object.keys(changes).length === 0) {
      return undefined;
    }
    this.privileges
      .for(EthnologueLanguage, ethnologue)
      .verifyChanges(withEffectiveSensitivity(changes, effectiveSensitivity));
    return {
      changes,
      updated: EthnologueLanguageUpdate.fromInput(changes),
      previous: EthnologueLanguageUpdate.pickPrevious(ethnologue, changes),
    };
  }

  async update(id: ID<EthnologueLanguage>, input: UpdateEthnologueLanguage) {
    await this.repo.update({ id, ...input });
  }
}
