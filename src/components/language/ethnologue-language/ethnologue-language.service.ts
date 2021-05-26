import { Injectable } from '@nestjs/common';
import { pickBy } from 'lodash';
import {
  ID,
  NotFoundException,
  ServerException,
  Session,
} from '../../../common';
import {
  ConfigService,
  DatabaseService,
  ILogger,
  Logger,
  Property,
} from '../../../core';
import { parsePropList } from '../../../core/database/results';
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
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly authorizationService: AuthorizationService,
    @Logger('language:ethnologue:service') private readonly logger: ILogger,
    private readonly repo: EthnologueLanguageRepository
  ) {}

  async create(
    input: CreateEthnologueLanguage,
    session: Session
  ): Promise<string> {
    await this.authorizationService.checkPower(Powers.CreateLanguage, session);
    const secureProps: Property[] = [
      {
        key: 'code',
        value: input.code,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'provisionalCode',
        value: input.provisionalCode,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'name',
        value: input.name,
        isPublic: false,
        isOrgPublic: false,
      },
      {
        key: 'population',
        value: input.population,
        isPublic: false,
        isOrgPublic: false,
      },
    ];

    const result = await this.repo.create(secureProps, session);
    if (!result) {
      throw new ServerException('Failed to create ethnologue language');
    }

    await this.authorizationService.processNewBaseNode(
      EthnologueLanguage,
      result.id,
      session.userId
    );

    const id = result.id;

    this.logger.debug(`ethnologue language created`, { id });

    return id;
  }

  async readOne(id: ID, session: Session): Promise<EthnologueLanguage> {
    const result = await this.repo.readOne(id, session);
    if (!result) {
      throw new NotFoundException(
        'Could not find ethnologue language',
        'ethnologue.id'
      );
    }

    const { id: _, ...props } = parsePropList(result.propList);
    const secured = await this.authorizationService.secureProperties(
      EthnologueLanguage,
      props,
      session
    );

    return {
      id,
      ...secured,
      canDelete: await this.repo.checkDeletePermission(id, session),
    };
  }

  async update(id: ID, input: UpdateEthnologueLanguage, session: Session) {
    if (!input) return;
    const ethnologueLanguage = await this.readOne(id, session);

    const changes = this.repo.getActualChanges(ethnologueLanguage, input);
    await this.authorizationService.verifyCanEditChanges(
      EthnologueLanguage,
      ethnologueLanguage,
      changes
    );

    if (Object.keys(changes).length === 0) {
      return;
    }

    // Make a mapping of the fields that we want to set in the db to the inputs
    const valueSet = pickBy(
      {
        'code.value': changes.code,
        'provisionalCode.value': changes.provisionalCode,
        'name.value': changes.name,
        'population.value': changes.population,
      },
      (v) => v !== undefined
    );

    try {
      await this.repo.updateProperties(id, valueSet);
    } catch (exception) {
      this.logger.error('update failed', { exception });
      throw new ServerException(
        'Failed to update ethnologue language',
        exception
      );
    }
  }
}
