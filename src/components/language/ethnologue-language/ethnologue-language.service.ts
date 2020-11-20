import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { pickBy } from 'lodash';
import {
  generateId,
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
  matchSession,
  Property,
} from '../../../core';
import { matchPermList, matchPropList } from '../../../core/database/query';
import {
  DbPropsOfDto,
  parseSecuredProperties,
  StandardReadResult,
} from '../../../core/database/results';
import { AuthorizationService } from '../../authorization/authorization.service';
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
    const secureProps: Property[] = [
      {
        key: 'code',
        value: input.code,
        isPublic: false,
        isOrgPublic: false,
        label: 'Code',
      },
      {
        key: 'provisionalCode',
        value: input.provisionalCode,
        isPublic: false,
        isOrgPublic: false,
        label: 'ProvisionalCode',
      },
      {
        key: 'name',
        value: input.name,
        isPublic: false,
        isOrgPublic: false,
        label: 'Name',
      },
      {
        key: 'population',
        value: input.population,
        isPublic: false,
        isOrgPublic: false,
        label: 'Population',
      },
    ];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(
        createBaseNode,
        await generateId(),
        'EthnologueLanguage',
        secureProps,
        {},
        [],
        session.userId === this.config.rootAdmin.id
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
      .call(matchPermList)
      .call(matchPropList, 'permList')
      .return('propList, permList, node')
      .asResult<StandardReadResult<EthLangDbProps>>();

    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find ethnologue language',
        'ethnologue.id'
      );
    }

    return {
      id,
      ...parseSecuredProperties(result.propList, result.permList, {
        code: true,
        provisionalCode: true,
        name: true,
        population: true,
      }),
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

    try {
      const query = this.db
        .query()
        .match(matchSession(session, { withAclRead: 'canReadLanguages' }))
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
