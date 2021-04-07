import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { pickBy } from 'lodash';
import {
  generateId,
  ID,
  NotFoundException,
  ServerException,
  Session,
} from '../../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  Property,
} from '../../../core';
import { matchPropList } from '../../../core/database/query';
import {
  DbPropsOfDto,
  parsePropList,
  StandardReadResult,
} from '../../../core/database/results';
import { AuthorizationService } from '../../authorization/authorization.service';
import { Powers } from '../../authorization/dto/powers';
import {
  CreateEthnologueLanguage,
  EthnologueLanguage,
  UpdateEthnologueLanguage,
} from '../dto';
import { DbEthnologueLanguage } from '../model';

type EthLangDbProps = DbPropsOfDto<EthnologueLanguage> & { id: ID };

@Injectable()
export class EthnologueLanguageService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    private readonly authorizationService: AuthorizationService,
    @Logger('language:ethnologue:service') private readonly logger: ILogger
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

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(
        createBaseNode,
        await generateId(),
        'EthnologueLanguage',
        secureProps
      )
      .return('node.id as id');

    const result = await query.first();
    if (!result) {
      throw new ServerException('Failed to create ethnologue language');
    }

    const dbEthnologueLanguage = new DbEthnologueLanguage();
    await this.authorizationService.processNewBaseNode(
      dbEthnologueLanguage,
      result.id,
      session.userId
    );

    const id = result.id;

    this.logger.debug(`ethnologue language created`, { id });

    return id;
  }

  async readOne(id: ID, session: Session): Promise<EthnologueLanguage> {
    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'EthnologueLanguage', { id: id })])
      .call(matchPropList)
      .return('propList, node')
      .asResult<StandardReadResult<EthLangDbProps>>();

    const result = await query.first();
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
      canDelete: await this.db.checkDeletePermission(id, session),
    };
  }

  async update(id: ID, input: UpdateEthnologueLanguage, session: Session) {
    if (!input) return;
    const ethnologueLanguage = await this.readOne(id, session);

    const changes = this.db.getActualChanges(
      EthnologueLanguage,
      ethnologueLanguage,
      input
    );

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

    // even though we already have a cleaned value set, we still need to verify edit permission
    await this.authorizationService.verifyCanEditChanges(
      EthnologueLanguage,
      ethnologueLanguage,
      changes
    );

    try {
      const query = this.db
        .query()
        .match([
          node('ethnologueLanguage', 'EthnologueLanguage', {
            id: id,
          }),
        ])
        .match([
          [
            node('ethnologueLanguage'),
            relation('out', '', 'code', { active: true }),
            node('code', 'Property'),
          ],
          [
            node('ethnologueLanguage'),
            relation('out', '', 'provisionalCode', { active: true }),
            node('provisionalCode', 'Property'),
          ],
          [
            node('ethnologueLanguage'),
            relation('out', '', 'name', { active: true }),
            node('name', 'Property'),
          ],
          [
            node('ethnologueLanguage'),
            relation('out', '', 'population', { active: true }),
            node('population', 'Property'),
          ],
        ])
        .setValues(valueSet);
      await query.run();
    } catch (exception) {
      this.logger.error('update failed', { exception });
      throw new ServerException(
        'Failed to update ethnologue language',
        exception
      );
    }
  }
}
