import { Injectable } from '@nestjs/common';
import {
  type ID,
  type Sensitivity,
  type Session,
  type UnsecuredDto,
} from '~/common';
import { Privileges, withEffectiveSensitivity } from '../../authorization';
import {
  type CreateEthnologueLanguage,
  EthnologueLanguage,
  type UpdateEthnologueLanguage,
} from '../dto';
import { EthnologueLanguageRepository } from './ethnologue-language.repository';

@Injectable()
export class EthnologueLanguageService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: EthnologueLanguageRepository,
  ) {}

  async create(input: CreateEthnologueLanguage, session: Session): Promise<ID> {
    this.privileges.for(EthnologueLanguage).verifyCan('create');

    //TODO - remove the passed in languageId after migration
    return (await this.repo.create({ languageId: 'temp' as ID, ...input })).id;
  }

  async readOne(
    id: ID,
    sensitivity: Sensitivity,
    session: Session,
  ): Promise<EthnologueLanguage> {
    const dto = await this.repo.readOne(id);
    return this.secure(dto, sensitivity, session);
  }

  secure(
    dto: UnsecuredDto<EthnologueLanguage>,
    sensitivity: Sensitivity,
    session: Session,
  ) {
    return {
      ...this.privileges
        .for(EthnologueLanguage)
        .secure(withEffectiveSensitivity(dto, sensitivity)),
      sensitivity,
    };
  }

  async update(
    id: ID,
    input: UpdateEthnologueLanguage,
    sensitivity: Sensitivity,
    session: Session,
  ) {
    if (!input) return;
    const ethnologueLanguage = await this.repo.readOne(id);

    const changes = this.repo.getActualChanges(ethnologueLanguage, input);
    this.privileges
      .for(EthnologueLanguage, ethnologueLanguage)
      .verifyChanges(withEffectiveSensitivity(changes, sensitivity));

    await this.repo.update({ id: ethnologueLanguage.id, ...changes });
  }
}
