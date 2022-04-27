import { Injectable } from '@nestjs/common';
import {
  ID,
  Sensitivity,
  ServerException,
  Session,
  UnsecuredDto,
} from '../../../common';
import { ILogger, Logger } from '../../../core';
import { AuthorizationService } from '../../authorization/authorization.service';
import { Powers } from '../../authorization/dto/powers';
import {
  CreateEthnologueLanguage,
  EthnologueLanguage,
  UpdateEthnologueLanguage,
} from '../dto';
import { EthnologueLanguageRepository } from './ethnologue-language.repository';

@Injectable()
export class EthnologueLanguageService {
  constructor(
    private readonly authorizationService: AuthorizationService,
    @Logger('language:ethnologue:service') private readonly logger: ILogger,
    private readonly repo: EthnologueLanguageRepository
  ) {}

  async create(input: CreateEthnologueLanguage, session: Session): Promise<ID> {
    await this.authorizationService.checkPower(
      Powers.CreateEthnologueLanguage,
      session
    );

    const result = await this.repo.create(input, session);
    if (!result) {
      throw new ServerException('Failed to create ethnologue language');
    }

    const id = result.id;

    this.logger.debug(`ethnologue language created`, { id });

    return id;
  }

  async readOne(
    id: ID,
    sensitivity: Sensitivity,
    session: Session
  ): Promise<EthnologueLanguage> {
    const dto = await this.repo.readOne(id);
    return await this.secure(dto, sensitivity, session);
  }

  async secure(
    dto: UnsecuredDto<EthnologueLanguage>,
    sensitivity: Sensitivity,
    session: Session
  ): Promise<EthnologueLanguage> {
    const secured = await this.authorizationService.secureProperties(
      EthnologueLanguage,
      { ...dto, sensitivity },
      session
    );

    return {
      ...dto,
      ...secured,
      sensitivity,
      canDelete: await this.repo.checkDeletePermission(dto.id, session),
    };
  }

  async update(
    id: ID,
    input: UpdateEthnologueLanguage,
    sensitivity: Sensitivity,
    session: Session
  ) {
    if (!input) return;
    const ethnologueLanguage = await this.readOne(id, sensitivity, session);

    const changes = this.repo.getActualChanges(ethnologueLanguage, input);
    await this.authorizationService.verifyCanEditChanges(
      EthnologueLanguage,
      ethnologueLanguage,
      changes
    );

    try {
      await this.repo.updateProperties(ethnologueLanguage, changes);
    } catch (exception) {
      this.logger.error('update failed', { exception });
      throw new ServerException(
        'Failed to update ethnologue language',
        exception
      );
    }
  }
}
