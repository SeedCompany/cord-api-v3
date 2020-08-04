import {
  Injectable,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { ISession } from '../../../common';
import {
  addAllSecureProperties,
  addPropertyCoalesceWithClause,
  addShapeForBaseNodeMetaProperty,
  addUserToSG,
  ConfigService,
  createBaseNode,
  createSG,
  DatabaseService,
  ILogger,
  Logger,
  matchRequestingUser,
  matchSession,
  matchUserPermissions,
  matchUserPermissionsIn,

  Property,
} from '../../../core';
import {
  CreateEthnologueLanguage,
  EthnologueLanguage,
  UpdateEthnologueLanguage,
} from '../dto';
import {addAllSecurePropertiesSimpleEdit, addAllSecurePropertiesSimpleRead, runListQuery} from "../../../core/database/query.helpers";

@Injectable()
export class EthnologueLanguageService {
  constructor(
    private readonly db: DatabaseService,
    private readonly config: ConfigService,
    @Logger('language:ethnologue:service') private readonly logger: ILogger
  ) {}

  // helper method for defining properties
  property = (prop: string, value: any) => {
    const createdAt = DateTime.local();
    const propLabel = 'Property';
    return [
      [
        node('newEthnologueLanguage'),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, propLabel, {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  permission = (property: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('adminSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          admin: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newEthnologueLanguage'),
      ],
      [
        node('readerSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: false,
          admin: false,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newEthnologueLanguage'),
      ],
    ];
  };

  propMatch = (property: string) => {
    const perm = 'canRead' + upperFirst(property);
    return [
      [
        node('requestingUser'),
        relation('in', '', 'member', { active: true }),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission', { active: true }),
        node(perm, 'Permission', {
          property,
          active: true,
          read: true,
        }),
        relation('out', '', 'baseNode', { active: true }),
        node('lang'),
        relation('out', '', property, { active: true }),
        node(property, 'Property', { active: true }),
      ],
    ];
  };

  async create(
    input: CreateEthnologueLanguage | undefined,
    session: ISession
  ): Promise<{ ethnologue: EthnologueLanguage; ethnologueId: string }> {
    if (!input) {
      input = Object.assign({}) as CreateEthnologueLanguage;
    }

    // create org
    const secureProps: Property[] = [
      {
        key: 'id',
        value: input.id,
        addToAdminSg: true,
        addToWriterSg: true,
        addToReaderSg: true,
        isPublic: true,
        isOrgPublic: true,
        label: 'Id',
      },
      {
        key: 'code',
        value: input.code,
        addToAdminSg: true,
        addToWriterSg: true,
        addToReaderSg: true,
        isPublic: true,
        isOrgPublic: true,
        label: 'Code',
      },
      {
        key: 'provisionalCode',
        value: input.provisionalCode,
        addToAdminSg: true,
        addToWriterSg: true,
        addToReaderSg: true,
        isPublic: true,
        isOrgPublic: true,
        label: 'ProvisionalCode',
      },
      {
        key: 'name',
        value: input.name,
        addToAdminSg: true,
        addToWriterSg: true,
        addToReaderSg: true,
        isPublic: true,
        isOrgPublic: true,
        label: 'Name',
      },
      {
        key: 'population',
        value: input.population,
        addToAdminSg: true,
        addToWriterSg: true,
        addToReaderSg: true,
        isPublic: true,
        isOrgPublic: true,
        label: 'Population',
      },
    ];
    // const baseMetaProps = [];

    const query = this.db
      .query()
      .match([
        node('root', 'User', { active: true, id: this.config.rootAdmin.id }),
      ])
      .match([
        node('publicSG', 'PublicSecurityGroup', {
          active: true,
          id: this.config.publicSecurityGroup.id,
        }),
      ])
      .call(matchRequestingUser, session)
      .call(createSG, 'orgSG', 'OrgPublicSecurityGroup')
      .call(createBaseNode, 'EthnologueLanguage', secureProps, {
        owningOrgId: session.owningOrgId,
      })
      .call(addUserToSG, 'requestingUser', 'adminSG') // must come after base node creation
      .return('node.id as id');

    const result = await query.first();

    if (!result) {
      throw new ServerException('failed to create ethnologuelanguage');
    }

    const id = result.id;

    // add root admin to new org as an admin
    await this.db.addRootAdminToBaseNodeAsAdmin(id, 'EthnologueLanguage');

    this.logger.debug(`ethnologue language created`, { id });

    return this.readOne(id, session);
  }

  async readOne(
    id: string,
    session: ISession
  ): Promise<{ ethnologue: EthnologueLanguage; ethnologueId: string }> {
    this.logger.info(`Read ethnologueLanguage`, {
      id: id,
      userId: session.userId,
    });

    if (!session.userId) {
      this.logger.info('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    const props = ['id', 'code', 'provisionalCode', 'name', 'population'];

    const baseNodeMetaProps = ['createdAt'];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissions, 'EthnologueLanguage', id)
      .call(addAllSecureProperties, ...props)
      .with([
        ...props.map(addPropertyCoalesceWithClause),
        ...baseNodeMetaProps.map(addShapeForBaseNodeMetaProperty),
        'node.id as ethnologueId',
        'node',
      ])
      .returnDistinct([
        ...props,
        ...baseNodeMetaProps,
        'ethnologueId',
        'labels(node) as labels',
      ]);

    // console.log('readOne', query.toString())
    const result = await query.first();

    return {
      ethnologue: result as EthnologueLanguage,
      ethnologueId: result?.ethnologueId,
    };
  }

  async readInList(
    ids: string[],
    session: ISession,
    input: any,
  ): Promise<any> {
    this.logger.info(`Read ethnologueLanguage`, {
      ids: ids,
      userId: session.userId,
    });

    if (!session.userId) {
      this.logger.info('using anon user id');
      session.userId = this.config.anonUser.id;
    }

    const props = ['id', 'code', 'provisionalCode', 'name', 'population'];

    const queryRead = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissionsIn, 'EthnologueLanguage', ids)
      .call(addAllSecurePropertiesSimpleRead, ...props)
      .with([
        `{${props.map(prop => `${prop}: {value: coalesce(${prop}.value), canRead: coalesce(${prop}ReadPerm.read, false) 
        }`).join(', ')}, ethnologueId: node.id, createdAt: node.createdAt}
        as item`,
      ])
      .with([
        'collect(distinct item) as items',
      ])
      .return('items')

    const result = await queryRead.run();

    const queryEdit = this.db
      .query()
      .call(matchRequestingUser, session)
      .call(matchUserPermissionsIn, 'EthnologueLanguage', ids)
      .call(addAllSecurePropertiesSimpleEdit, ...props)
      .with([
        `{${props.map(prop => `${prop}: {value: coalesce(${prop}.value), canEdit: coalesce(${prop}EditPerm.edit, false)
        }`).join(', ')}, ethnologueId: node.id, createdAt: node.createdAt}
        as item`,
      ])
      .with([
        'collect(distinct item) as items',
      ])
      .return('items')

    const resultEdit = await queryEdit.run();
    let items = result && result[0] && [...result[0].items]

    const itemsEdit = resultEdit && resultEdit[0] && resultEdit[0].items

    items = items.map((item: any) => {
      let data = {...item}
      const edit = itemsEdit.find((i: any) => i.ethnologueId === item.ethnologueId)

      if (edit) {
        Object.keys(edit).forEach(key => {
          if (edit[key]['canEdit']) {
            data[key]['canEdit'] = edit[key]['canEdit']
          }
        })
      }

      return data
    })

    return items || []
  }

  async update(id: string, input: UpdateEthnologueLanguage, session: ISession) {
    if (!input) return;

    this.logger.info(`Update ethnologue language`, {
      id,
      input,
      userId: session.userId,
    });

    try {
      const query = this.db
        .query()
        .match(matchSession(session, { withAclRead: 'canReadLanguages' }))
        .match([
          node('ethnologueLanguage', 'EthnologueLanguage', {
            active: true,
            id: id,
          }),
        ])
        .match([
          [
            node('ethnologueLanguage'),
            relation('out', '', 'id', { active: true }),
            node('id', 'Property', { active: true }),
          ],
          [
            node('ethnologueLanguage'),
            relation('out', '', 'code', { active: true }),
            node('code', 'Property', { active: true }),
          ],
          [
            node('ethnologueLanguage'),
            relation('out', '', 'provisionalCode', { active: true }),
            node('provisionalCode', 'Property', { active: true }),
          ],
          [
            node('ethnologueLanguage'),
            relation('out', '', 'name', { active: true }),
            node('name', 'Property', { active: true }),
          ],
          [
            node('ethnologueLanguage'),
            relation('out', '', 'population', { active: true }),
            node('population', 'Property', { active: true }),
          ],
        ])
        .setValues({
          'id.value': input.id,
          'code.value': input.code,
          'provisionalCode.value': input.provisionalCode,
          'name.value': input.name,
          'population.value': input.population,
        });
      await query.run();
    } catch (e) {
      this.logger.error('update failed', { exception: e });
      throw new ServerException('Failed to update ethnologue language');
    }
  }
}
