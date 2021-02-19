import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { pickBy } from 'lodash';
import {
  generateId,
  NotFoundException,
  ServerException,
  Session,
  UnauthorizedException,
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

type EthLangDbProps = DbPropsOfDto<EthnologueLanguage> & { id: string };

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

  async readOne(id: string, session: Session): Promise<EthnologueLanguage> {
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
    const securedProperties = {
      code: true,
      provisionalCode: true,
      name: true,
      population: true,
    };

    const secured = await this.authorizationService.getPermissionsOfBaseNode({
      baseNode: new DbEthnologueLanguage(),
      sessionOrUserId: session,
      propList: result.propList,
      propKeys: securedProperties,
      nodeId: id,
    });

    return {
      id,
      ...secured,
    };
  }

  async update(id: string, input: UpdateEthnologueLanguage, session: Session) {
    if (!input) return;

    // Make a mapping of the fields that we want to set in the db to the inputs
    const valueSet = {
      'code.value': input.code,
      'provisionalCode.value': input.provisionalCode,
      'name.value': input.name,
      'population.value': input.population,
    };

    // filter out all of the undefined values so we only have a mapping of entries that the user wanted to edit
    const valueSetCleaned = pickBy(valueSet, (v) => v !== undefined);
    const valueSetCleanedKeys = Object.keys(valueSetCleaned);

    for (const key of valueSetCleanedKeys) {
      const q = await this.db
        .query()
        .match([
          node('user', 'User', { id: session.userId }),
          relation('in', 'memberOfSecurityGroup', 'member'),
          node('security', 'SecurityGroup'),
          relation('out', 'sgPerms', 'permission'),
          node('perm', 'Permission', {
            property: `${key.replace('.value', '')}`,
            edit: true,
          }),
          relation('out', 'permsOfBaseNode', 'baseNode'),
          node('ethnologueLanguage', 'EthnologueLanguage', { id: id }),
        ])
        .return(['user', 'perm', 'ethnologueLanguage'])
        .first();
      if (!q) {
        throw new UnauthorizedException(
          `You do not have permission to edit his object', '${key}`
        );
      }
    }

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
        .setValues(valueSetCleaned);
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
