import { Injectable } from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { pickBy } from 'lodash';
import { ISession, NotFoundException, ServerException } from '../../../common';
import {
  ConfigService,
  createBaseNode,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  matchUserPermissionsIn,
  Property,
} from '../../../core';
import {
  addAllSecurePropertiesSimpleEdit,
  addAllSecurePropertiesSimpleRead,
} from '../../../core/database/query.helpers';
import {
  DbPropsOfDto,
  parseSecuredProperties,
  StandardReadResult,
} from '../../../core/database/results';
import { AuthorizationService } from '../../authorization/authorization.service';
import { InternalAdminRole } from '../../authorization/roles';
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
    session: ISession
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
    await this.authorizationService.addUsersToBaseNodeByRole(
      InternalAdminRole,
      dbEthnologueLanguage,
      result.id,
      session.userId as string
    );

    const id = result.id;

    this.logger.debug(`ethnologue language created`, { id });

    return id;
  }

  async readOne(id: string, session: ISession): Promise<EthnologueLanguage> {
    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'EthnologueLanguage', { id: id })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member'),
        node('', 'SecurityGroup'),
        relation('out', '', 'permission'),
        node('perms', 'Permission'),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .with('collect(distinct perms) as permList, node')
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('props', 'Property'),
      ])
      .with('{value: props.value, property: type(r)} as prop, permList, node')
      .with('collect(prop) as propList, permList, node')
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

  async readInList(ids: string[], session: ISession): Promise<any> {
    if (!session.userId) {
      session.userId = this.config.anonUser.id;
    }

    const props = ['code', 'provisionalCode', 'name', 'population'];

    const queryRead = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissionsIn, 'EthnologueLanguage', ids)
      .call(addAllSecurePropertiesSimpleRead, ...props)
      .with([
        `{${props
          .map(
            (
              prop
            ) => `${prop}: {value: coalesce(${prop}.value), canRead: coalesce(${prop}ReadPerm.read, false)
        }`
          )
          .join(', ')}, ethnologueId: node.id, createdAt: node.createdAt}
        as item`,
      ])
      .with(['collect(distinct item) as items'])
      .return('items');

    const result = await queryRead.run();

    const queryEdit = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissionsIn, 'EthnologueLanguage', ids)
      .call(addAllSecurePropertiesSimpleEdit, ...props)
      .with([
        `{${props
          .map(
            (
              prop
            ) => `${prop}: {value: coalesce(${prop}.value), canEdit: coalesce(${prop}EditPerm.edit, false)
        }`
          )
          .join(', ')}, ethnologueId: node.id, createdAt: node.createdAt}
        as item`,
      ])
      .with(['collect(distinct item) as items'])
      .return('items');

    const resultEdit = await queryEdit.run();
    let items = result?.[0] && [...result[0].items];

    const itemsEdit = resultEdit?.[0]?.items;

    items = items.map((item: any) => {
      const data = { ...item };
      const edit = itemsEdit.find(
        (i: any) => i.ethnologueId === item.ethnologueId
      );

      if (edit) {
        Object.keys(edit).forEach((key) => {
          if (edit[key].canEdit) {
            data[key].canEdit = edit[key].canEdit;
          }
        });
      }

      return data;
    });

    return items || [];
  }

  async update(id: string, input: UpdateEthnologueLanguage, session: ISession) {
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
