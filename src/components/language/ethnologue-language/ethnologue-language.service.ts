import { Injectable } from '@nestjs/common';
import { ID, Sensitivity, Session, UnsecuredDto } from '~/common';
import { Privileges, withEffectiveSensitivity } from '../../authorization';
import {
  CreateEthnologueLanguage,
  EthnologueLanguage,
  UpdateEthnologueLanguage,
} from '../dto';
import { EthnologueLanguageRepository } from './ethnologue-language.repository';

@Injectable()
export class EthnologueLanguageService {
  constructor(
    private readonly privileges: Privileges,
    private readonly repo: EthnologueLanguageRepository,
  ) {}

  async create(input: CreateEthnologueLanguage, session: Session): Promise<ID> {
    this.privileges.for(session, EthnologueLanguage).verifyCan('create');

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
        .for(session, EthnologueLanguage)
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
    if (Object.keys(changes).length === 0) {
      return;
    }
    this.privileges
      .for(session, EthnologueLanguage, ethnologueLanguage)
      .verifyChanges(withEffectiveSensitivity(changes, sensitivity));

    await this.repo.update({ id: ethnologueLanguage.id, ...changes });
  }
}
