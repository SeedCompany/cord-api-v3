import {
  Injectable,
  InternalServerErrorException as ServerException,
} from '@nestjs/common';
import { node, relation } from 'cypher-query-builder';
import { upperFirst } from 'lodash';
import { DateTime } from 'luxon';
import { ISession } from '../../../common';
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
  CreateEthnologueLanguage,
  EthnologueLanguage,
  UpdateEthnologueLanguage,
} from '../dto';

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
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'Id',
      },
      {
        key: 'code',
        value: input.code,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'Code',
      },
      {
        key: 'provisionalCode',
        value: input.provisionalCode,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'ProvisionalCode',
      },
      {
        key: 'name',
        value: input.name,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'Name',
      },
      {
        key: 'population',
        value: input.population,
        addToAdminSg: true,
        addToWriterSg: false,
        addToReaderSg: true,
        isPublic: false,
        isOrgPublic: false,
        label: 'Population',
      },
    ];
    // const baseMetaProps = [];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([
        node('root', 'User', { active: true, id: this.config.rootAdmin.id }),
      ])
      .call(
        createBaseNode,
        'EthnologueLanguage',
        secureProps,
        {
          owningOrgId: session.owningOrgId,
        },
        [],
        session.userId === this.config.rootAdmin.id
      )
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

    // const props = ['id', 'code', 'provisionalCode', 'name', 'population'];

    // const baseNodeMetaProps = ['createdAt'];

    const query = this.db
      .query()
      .call(matchRequestingUser, session)
      .match([node('node', 'EthnologueLanguage', { active: true, id: id })])
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member*1..'),
        node('', 'SecurityGroup', { active: true }),
        relation('out', '', 'permission'),
        node('perms', 'Permission', { active: true }),
        relation('out', '', 'baseNode'),
        node('node'),
      ])
      .with('collect(distinct perms) as permList, node')
      .match([
        node('node'),
        relation('out', 'r', { active: true }),
        node('props', 'Property', { active: true }),
      ])
      .with('{value: props.value, property: type(r)} as prop, permList, node')
      .with('collect(prop) as propList, permList, node')
      .return('propList, permList, node');

    const result = await query.first();

    const response: any = {
      createdAt: result?.node?.properties?.createdAt,
    };

    const perms: any = {};
    const permList = result?.permList;

    if (permList) {
      for (const {
        properties: { property, read, edit },
      } of permList) {
        const currentPermission = perms[property];
        if (!currentPermission) {
          perms[property] = {
            canRead: Boolean(read),
            canEdit: Boolean(edit),
          };
        } else {
          currentPermission.canRead = currentPermission.canRead || read;
          currentPermission.canEdit = currentPermission.canEdit || edit;
        }
      }
    }

    const propList = result?.propList;
    // console.log('perms', perms)
    if (propList) {
      for (const record of propList) {
        if (!response[record.property]) {
          response[record.property] = {};
        }
        if (record?.property) {
          const canRead = perms[record.property]?.canRead ?? false;
          response[record.property] = {
            value: canRead ? record.value : null,
            canRead: canRead,
            canEdit: perms[record.property]
              ? perms[record.property].canEdit
              : false,
          };
        }
      }
    }

    return {
      ethnologue: response,
      ethnologueId: result?.node?.properties?.id,
    };
  }

  async readInList(ids: string[], session: ISession): Promise<any> {
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
