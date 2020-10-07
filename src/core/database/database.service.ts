import { Injectable } from '@nestjs/common';
import {
  Connection,
  equals,
  node,
  Query,
  regexp,
  relation,
} from 'cypher-query-builder';
import type { Pattern } from 'cypher-query-builder/dist/typings/clauses/pattern';
import { cloneDeep, Many, upperFirst, without } from 'lodash';
import { DateTime, Duration } from 'luxon';
import { generate } from 'shortid';
import { assert } from 'ts-essentials';
import {
  InputException,
  ISession,
  isSecured,
  many,
  mapFromList,
  Order,
  Resource,
  ServerException,
  UnauthorizedException,
  UnwrapSecured,
  unwrapSecured,
} from '../../common';
import { ILogger, Logger } from '..';
import { ConfigService } from '../config/config.service';
import { hasMore, setBaseNodeLabelsDeleted } from './query.helpers';

interface ReadPropertyResult {
  value: any;
  canEdit: boolean;
  canRead: boolean;
}

export type ACLs = Record<string, boolean>;

/** A value that con be passed into the db */
export type DbValue = Many<
  string | number | boolean | DateTime | Duration | null | undefined
>;

// helper method for defining permissions
export const permission = (property: string, baseNode: string) => {
  return [
    [
      node('adminSG'),
      relation('out', '', 'permission'),
      node('', 'Permission', {
        property,
        read: true,
        edit: true,
        admin: true,
      }),
      relation('out', '', 'baseNode'),
      node(baseNode),
    ],
    [
      node('readerSG'),
      relation('out', '', 'permission'),
      node('', 'Permission', {
        property,
        read: true,
        edit: false,
        admin: false,
      }),
      relation('out', '', 'baseNode'),
      node(baseNode),
    ],
  ];
};

export const permissions = (baseNode: string, properties: string[]) => {
  return properties.flatMap((property) => permission(property, baseNode));
};

export const property = (
  prop: string,
  value: any | null,
  baseNode: string,
  propVar = prop,
  extraPropLabel?: Many<string>
) => [
  [
    node(baseNode),
    relation('out', '', prop, {
      active: true,
      createdAt: DateTime.local(),
    }),
    node(propVar, ['Property', ...many(extraPropLabel ?? [])], {
      value,
    }),
  ],
];

export const matchSession = (
  session: ISession,
  {
    // eslint-disable-next-line @seedcompany/no-unused-vars
    withAclEdit,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    withAclRead,
    requestingUserConditions = {},
  }: {
    withAclEdit?: string;
    withAclRead?: string;
    requestingUserConditions?: Record<string, any>;
  } = {}
) => [
  node('token', 'Token', {
    active: true,
    value: session.token,
  }),
  relation('in', '', 'token', {
    active: true,
  }),
  node('requestingUser', 'User', {
    id: session.userId,
    ...requestingUserConditions,
  }),
];

@Injectable()
export class DatabaseService {
  constructor(
    private readonly db: Connection,
    private readonly config: ConfigService,
    @Logger('database:service') private readonly logger: ILogger
  ) {}

  query(): Query {
    return this.db.query();
  }

  async readProperties<TObject extends Resource>({
    id,
    session,
    props,
    nodevar,
    aclReadNode,
  }: {
    id: string;
    session: ISession;
    props: ReadonlyArray<keyof TObject>;
    nodevar: string;
    aclReadNode?: string;
  }): Promise<{ [Key in keyof TObject]: ReadPropertyResult }> {
    const result: { [Key in keyof TObject]: ReadPropertyResult } = {} as any;
    for (const prop of props) {
      result[prop] = await this.readProperty({
        id,
        session,
        aclReadProp: prop as string,
        aclReadNode,
        nodevar,
      });
    }
    return result;
  }

  async hasSgReadProperty<TObject extends Resource>({
    id,
    session,
    property,
    nodevar,
  }: {
    id: string;
    session: ISession;
    property: string;
    nodevar: string;
  }): Promise<boolean> {
    let type: string = upperFirst(nodevar);

    if (nodevar === 'Lang') {
      type = 'Language';
    }
    const query = this.db.query();
    if (session.userId) {
      query.match([matchSession(session, {})]);
    }

    query.match([
      [
        // node('requestingUser'),
        // relation('in', '', 'member', { active: true }),
        node('sg', 'SecurityGroup'),
        relation('out', '', 'permission'),
        node('perm', 'Permission', {
          property,
          read: true,
        }),
        relation('out', '', 'baseNode'),
        node('n', type, { id }),
        relation('out', '', property, { active: true }),
        node([property], 'Property'),
      ],
    ]);

    query.return(['sg', 'perm', 'n', property]);

    let result;
    try {
      result = await query.run();
    } catch (e) {
      this.logger.error(e);
    }

    return !!result;
  }

  async sgReadProperties<TObject extends Resource>({
    id,
    session,
    props,
    nodevar,
  }: {
    id: string;
    session: ISession;
    props: string[];
    nodevar: string;
  }): Promise<any | undefined> {
    // this.logger.debug('sgReadProperties', { id, session, props, nodevar });
    let type: string = upperFirst(nodevar);

    if (nodevar === 'Lang') {
      type = 'Language';
    }
    const query = this.db.query();
    if (session.userId) {
      query.match([matchSession(session, {})]);
      query.match([
        node('requestingUser'),
        relation('in', '', 'member'),
        node('sg', 'SecurityGroup'),
      ]);
    }
    const nonMetaProps = without(props, 'id', 'createdAt');
    const permNodes = nonMetaProps.map((p) => `perm${p}`);

    for (const property of nonMetaProps) {
      query.match([
        [
          node('sg', 'SecurityGroup'),
          relation('out', '', 'permission'),
          node(`perm${property}`, 'Permission', {
            property,
            read: true,
          }),
          relation('out', '', 'baseNode'),
          node('n', type, { id }),
          relation('out', '', property, { active: true }),
          node(property, 'Property'),
        ],
      ]);
    }
    query.return(['sg', 'n', ...nonMetaProps, ...permNodes]);

    let result: { sg: any; perm: any; p: any; n: any } | any | undefined;
    try {
      result = await query.first();
    } catch (e) {
      this.logger.error(e);
    }

    if (!result) {
      return undefined;
    }

    return {
      id: { value: id, canRead: true, canEdit: true },
      createdAt: {
        value: result.n.properties.createdat,
        canRead: true,
        canEdit: true,
      },
      ...mapFromList(nonMetaProps, (property) => {
        const val = {
          value: result[property].properties.value,
          canRead: result['perm' + property].properties.read,
          canEdit: result['perm' + property].properties.edit,
        };
        return [property, val];
      }),
    };
  }

  async sgUpdateProperties<TObject extends Resource>({
    session,
    object,
    props,
    changes,
    nodevar,
  }: {
    session: ISession;
    object: TObject;
    props: ReadonlyArray<keyof TObject>;
    changes: { [Key in keyof TObject]?: UnwrapSecured<TObject[Key]> };
    nodevar: string;
  }) {
    let updated = object;
    for (const prop of props) {
      if (
        changes[prop] === undefined ||
        unwrapSecured(object[prop]) === changes[prop]
      ) {
        continue;
      }
      updated = await this.sgUpdateProperty({
        object: updated,
        session,
        key: prop,
        value: changes[prop],
        nodevar,
      });
    }
    return updated;
  }

  async sgUpdateProperty<TObject extends Resource, Key extends keyof TObject>({
    session,
    object,
    key,
    value,
    nodevar,
  }: {
    session: ISession;
    object: TObject;
    key: Key;
    value?: UnwrapSecured<TObject[Key]>;
    aclEditProp?: string;
    nodevar: string;
  }): Promise<TObject> {
    const createdAt = DateTime.local();
    const update = this.db
      .query()
      .match([matchSession(session)])
      .match([
        node(nodevar, upperFirst(nodevar), {
          id: object.id,
        }),
      ])
      .match([
        node('requestingUser'),
        relation('in', '', 'member'),
        node('', 'SecurityGroup'),
        relation('out', '', 'permission'),
        node('', 'Permission', {
          property: key as string,
          // admin: true,
          edit: true,
        }),
        relation('out', '', 'baseNode'),
        node(nodevar),
        relation('out', 'oldToProp', key as string, { active: true }),
        node('oldPropVar', 'Property'),
      ])
      .setValues({
        'oldToProp.active': false,
      })
      .with('*')
      .limit(1)
      .create([
        node(nodevar),
        relation('out', 'toProp', key as string, {
          active: true,
          createdAt,
        }),
        node('newPropNode', 'Property', {
          createdAt,
          value,
        }),
      ])
      .return('newPropNode');
    let result;

    try {
      result = await update.first();
    } catch (e) {
      this.logger.error('Neo4jError ', e);
    }

    if (!result) {
      throw new InputException('Could not find object');
    }

    return {
      ...object,
      ...(isSecured(object[key])
        ? // replace value in secured object keeping can* properties
          {
            [key]: {
              ...object[key],
              value,
            },
          }
        : // replace value directly
          { [key]: value }),
    };
  }

  async readProperty<TObject extends Resource>({
    id,
    session,
    nodevar,
    aclReadProp,
    aclReadNode,
  }: {
    id: string;
    session: ISession;
    nodevar: string;
    aclReadProp: string;
    aclReadNode?: string;
  }): Promise<ReadPropertyResult> {
    const aclReadPropName = `canRead${upperFirst(aclReadProp)}`;
    const aclEditPropName = `canEdit${upperFirst(aclReadProp)}`;

    const aclReadNodeName = aclReadNode || `canRead${upperFirst(nodevar)}s`;
    let content: string;
    let type = nodevar;

    if (nodevar === 'lang') {
      type = 'language';
    }

    if (aclReadProp === 'id' || aclReadProp === 'createdAt') {
      content = `
      (${nodevar}:${upperFirst(type)} { id: $id })
      return ${nodevar}.${aclReadProp} as value, ${nodevar}.${aclReadNodeName} as canRead, null as canEdit
      `;
    } else {
      content = `
      (${nodevar}: ${upperFirst(type)} { id: $id })
      WITH * OPTIONAL MATCH (user)<-[:member]-(acl:ACL { ${aclReadPropName}: true })
      -[:toNode]->(${nodevar})-[:${aclReadProp} ]->(${aclReadProp}:Property )
      RETURN ${aclReadProp}.value as value, acl.${aclReadPropName} as canRead, acl.${aclEditPropName} as canEdit
      `;
    }

    const query = `
    match  (token:Token {
      active: true,
      value: $token
    })
    <-[:token { active: true }]-
    (user:User {  ${aclReadNodeName}: true }),${content}`;

    const result = (await this.db
      .query()
      .raw(query, {
        token: session.token,
        userId: session.userId,

        id,
      })
      .first()) as ReadPropertyResult;

    if (!result) {
      return { value: null, canRead: false, canEdit: false };
    }

    return result;
  }

  async list<TObject extends Resource>({
    session,
    props,
    nodevar,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    owningOrgId,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    skipOwningOrgCheck,
    aclReadProp,
    aclEditProp,
    input,
  }: {
    session: ISession;
    props: ReadonlyArray<
      keyof TObject | { secure: boolean; name: keyof TObject; list?: boolean }
    >;
    nodevar: string;
    owningOrgId?: string;
    skipOwningOrgCheck?: boolean;
    aclReadProp?: string;
    aclEditProp?: string;
    input: {
      page: number;
      count: number;
      sort: string;
      order: Order;
      filter: Record<string, any>;
    };
  }): Promise<{ hasMore: boolean; total: number; items: TObject[] }> {
    const nodeName = upperFirst(nodevar);
    const aclReadPropName = aclReadProp || `canRead${nodeName}`;
    const aclEditPropName = aclEditProp || `canEdit${nodeName}`;
    const idFilter = input.filter.id ? { id: input.filter.id } : {};
    const userIdFilter = input.filter.userId ? { id: input.filter.userId } : {};
    const mineFilter = input.filter.mine ? { id: session.userId } : {};

    const query = this.db.query().match([
      matchSession(session, {
        withAclRead: aclReadPropName,
      }),
    ]);

    if (Object.keys(userIdFilter).length) {
      query.match([
        [
          node('user', 'User', {
            ...userIdFilter,
          }),
          relation('out', '', nodevar, {
            active: true,
          }),
          node('n', nodeName, {
            ...idFilter,
          }),
        ],
      ]);
    } else {
      query.match([
        node('n', nodeName, {
          ...idFilter,
        }),
      ]);
    }
    if (mineFilter.id) {
      query.match([
        [
          node('requestingUser'),
          relation('in', '', 'user', { active: true }),
          node('projectMember', 'ProjectMember'),
          relation('out', '', 'roles', { active: true }),
          node('role', 'Property', {
            value: ['ProjectManager'],
          }),
        ],
        [
          node('projectMember'),
          relation('in', '', 'member', { active: true }),
          node('n'),
        ],
      ]);
    }
    query.with('count(n) as total, requestingUser, n');

    for (const prop of props) {
      const propName = typeof prop === 'object' ? prop.name : prop;

      query.optionalMatch([
        node('n', nodeName),
        relation('out', '', propName as string, { active: true }),
        node(propName as string, 'Property'),
      ]);
    }

    query.with([
      // with the ACL fields
      'requestingUser',

      // always with <node>
      'n',

      // with the rest of the requested properties
      ...props.map((prop) => {
        const propName = (typeof prop === 'object'
          ? prop.name
          : prop) as string;
        return propName;
      }),
    ]);

    if (input.filter && Object.keys(input.filter).length) {
      const where: Record<string, any> = {};
      for (const [k, val] of Object.entries(input.filter)) {
        if (k !== 'id' && k !== 'userId' && k !== 'mine') {
          assert(
            typeof val === 'string',
            `Filter "${k}" must have a string value`
          );
          if (!Array.isArray(val)) {
            where[k + '.value'] = regexp(`.*${val}.*`, true);
          } else {
            where[k + '.value'] = equals(val);
          }
        }
      }
      if (Object.keys(where).length) {
        query.where(where);
      }
    }

    // Clone the query here, before we apply limit/offsets, so that we can get an accurate aggregate of the total filtered result set
    const countQuery = cloneDeep(query);
    countQuery.return('count(n) as total');

    query
      .returnDistinct([
        // return the ACL fields
        {
          requestingUser: [
            { [aclReadPropName]: aclReadPropName },
            { [aclEditPropName]: aclEditPropName },
          ],
        },

        // always return the <node>.id and <node>.createdAt field
        {
          n: [{ id: 'id' }, { createdAt: 'createdAt' }],
        },

        // return the rest of the requested properties
        ...props.map((prop) => {
          const propName = (typeof prop === 'object'
            ? prop.name
            : prop) as string;
          return { [propName + '.value']: propName };
        }),
      ])
      .orderBy([input.sort], input.order)
      .skip((input.page - 1) * input.count)
      .limit(input.count);

    const result = await query.run();
    const countResult = await countQuery.run();

    const total = countResult[0]?.total || 0;

    const items = result.map<TObject>((row) => {
      const item: any = {
        id: row.id,
        createdAt: row.createdAt,
      };

      for (const prop of props) {
        const propName = (typeof prop === 'object'
          ? prop.name
          : prop) as string;
        const secure = typeof prop === 'object' ? prop.secure : true;
        const list = typeof prop === 'object' ? prop.list : false;

        if (list) {
          const value = row[propName] ?? [];

          if (secure) {
            item[propName] = {
              value,
              canRead: Boolean(row[aclReadPropName]) || false,
              canEdit: Boolean(row[aclEditPropName]) || false,
            };
          } else {
            item[propName] = value;
          }
        } else if (secure) {
          item[propName] = {
            value: row[propName],
            canRead: Boolean(row[aclReadPropName]) || false,
            canEdit: Boolean(row[aclEditPropName]) || false,
          };
        } else {
          item[propName] = row[propName];
        }
      }

      return item;
    });

    return {
      hasMore: hasMore(input, total),
      total,
      items,
    };
  }

  async deleteNodeNew<TObject extends Resource>({
    object,
    baseNodeLabels,
  }: {
    object: TObject;
    baseNodeLabels: string[];
  }) {
    const query = this.db

      .query()
      .match(node('node', { id: object.id }))
      //Mark any parent base node relationships (pointing to the base node) as active = false.
      .optionalMatch([
        node('node'),
        relation('in', 'rel'),
        node('', 'BaseNode'),
      ])
      .set({
        values: {
          'rel.active': false,
        },
      })
      .with('*')
      //Mark labels Deleted
      .call(setBaseNodeLabelsDeleted, baseNodeLabels)
      .return('*');

    await query.run();
  }

  async deleteNode<TObject extends Resource>({
    session,
    object,
    // eslint-disable-next-line @seedcompany/no-unused-vars
    aclEditProp, // example canCreateLangs
  }: {
    session: ISession;
    object: TObject;
    aclEditProp: string;
  }) {
    await this.db
      .query()
      .raw(
        `
        MATCH
        (token:Token {
          active: true,
          value: $token
        })
        <-[:token {active: true}]-
        (requestingUser:User {

          id: $requestingUserId
        }),
        (object {

          id: $objectId
        })
        detach delete object

        `,
        {
          requestingUserId: session.userId,
          token: session.token,
          objectId: object.id,
        }
      )
      .run();
  }

  async deleteProperties<TObject extends Resource>({
    session,
    object,
    props,
    nodevar,
  }: {
    session: ISession;
    object: TObject;
    props: ReadonlyArray<keyof TObject>;
    nodevar: string;
  }) {
    for (const prop of props) {
      await this.deleteProperty({
        object,
        session,
        key: prop,
        nodevar,
      });
    }
  }

  async deleteProperty<TObject extends Resource, Key extends keyof TObject>({
    session,
    object,
    key,
    aclEditProp,
    nodevar,
  }: {
    session: ISession;
    object: TObject;
    key: Key;
    aclEditProp?: string;
    nodevar: string;
  }): Promise<void> {
    const aclEditPropName =
      aclEditProp || `canEdit${upperFirst(key as string)}`;

    const result = await this.db
      .query()
      .match([matchSession(session)])
      .with('*')
      .optionalMatch([
        node(nodevar, upperFirst(nodevar), {
          id: object.id,
        }),
      ])
      .with('*')
      .optionalMatch([
        node('requestingUser'),
        relation('in', '', 'member'),
        node('acl', 'ACL', { [aclEditPropName]: true }),
        relation('out', '', 'toNode'),
        node(nodevar),
        relation('out', 'oldToProp', key as string, { active: true }),
        node('oldPropVar', 'Property'),
      ])
      .setValues({
        'oldToProp.active': false,
      })
      .return('oldPropNode')
      .first();

    if (!result) {
      throw new InputException('Could not find object');
    }
  }

  async hasProperties({
    session,
    id,
    props,
    nodevar,
  }: {
    id: string;
    session: ISession;
    props: string[];
    nodevar: string;
  }): Promise<boolean> {
    const resultingArr = [];
    for (const prop of props) {
      const hasProp = await this.hasProperty({
        session,
        id,
        prop,
        nodevar,
      });
      resultingArr.push(hasProp);
    }
    return resultingArr.every((n) => n);
  }

  async hasProperty({
    id,
    session,
    prop,
    nodevar,
  }: {
    id: string;
    session: ISession;
    prop: string;
    nodevar: string;
  }): Promise<boolean> {
    const result = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node(nodevar, upperFirst(nodevar), {
            id,
            active: true,
          }),
          relation('out', 'rel', prop, { active: true }),
          node(prop, 'Property', { active: true }),
        ],
      ])
      .return('count(rel) as total')
      .first();

    const totalNumber = result?.total || 0;
    const hasPropertyNode = totalNumber > 0;
    return hasPropertyNode;
  }

  async isRelationshipUnique({
    session,
    id,
    relName,
    srcNodeLabel,
  }: {
    session: ISession;
    id: string;
    relName: string;
    srcNodeLabel: string;
  }): Promise<boolean> {
    const result = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('n', srcNodeLabel, {
            id,
            active: true,
          }),
          relation('out', 'rel', relName, { active: true }),
          node('', { active: true }),
        ],
      ])
      .return('count(rel) as total')
      .first();

    const totalNumber = result?.total || 0;
    const isUnique = totalNumber <= 1;

    return isUnique;
  }

  async isUniqueProperties({
    session,
    id,
    props,
    nodevar,
  }: {
    id: string;
    session: ISession;
    props: string[];
    nodevar: string;
  }): Promise<boolean> {
    const resultingArr = [];
    for (const prop of props) {
      const isUnique = await this.isUniqueProperty({
        session,
        id,
        prop,
        nodevar,
      });
      resultingArr.push(isUnique);
    }
    return resultingArr.every((n) => n);
  }

  async isUniqueProperty({
    id,
    session,
    prop,
    nodevar,
  }: {
    id: string;
    session: ISession;
    prop: string;
    nodevar: string;
  }): Promise<boolean> {
    const query = this.db
      .query()
      .match([
        matchSession(session),
        [
          node(nodevar, upperFirst(nodevar), {
            id,
            active: true,
          }),
          relation('out', 'rel', prop, { active: true }),
          node(prop, 'Property', { active: true }),
        ],
      ])
      .return('count(rel) as total');
    //.first();

    const result = await query.first();
    const totalNumber = result?.total || 0;

    const isUniqueProperty = totalNumber <= 1;
    return isUniqueProperty;
  }

  async addLabelsToPropNodes(
    baseNodeId: string,
    property: string,
    lables: string[]
  ): Promise<void> {
    const addLabel = this.db
      .query()
      .match([node('baseNode', { active: true, id: baseNodeId })])
      .match([
        node('baseNode'),
        relation('out', 'rel', property, { active: true }),
        node('prop', 'Property', { active: true }),
      ])
      .set({
        labels: {
          prop: lables,
        },
      })
      .return('baseNode');
    // const printme = addLabel;
    // console.log('printme :>> ', printme.interpolate());
    await addLabel.run();
  }

  assertPatternsIncludeIdentifier(
    patterns: Pattern[][],
    ...identifiers: string[]
  ) {
    if (process.env.NODE_ENV === 'production') {
      return;
    }
    for (const identifier of identifiers) {
      assert(
        patterns.some((nodes) =>
          nodes.some((node) => node.getNameString() === identifier)
        ),
        `Patterns must define identifier: "${identifier}"`
      );
    }
  }

  async sgCreateNode<TObject>({
    session,
    input,
    propLabels,
    nodevar,
    aclEditProp,
    sgName,
  }: {
    session: ISession;
    input: TObject;
    propLabels: TObject;
    nodevar: string;
    aclEditProp?: string;
    sgName: string;
  }) {
    const id = generate();
    const createdAt = DateTime.local();
    const nodeName = upperFirst(nodevar);
    const aclEditPropName = aclEditProp || `canEdit${nodeName}`;
    const baseNode = nodeName + ':BaseNode';
    const isRootSGMember = await this.isRootSecurityGroupMember(session);
    const properties = Object.entries(input).flatMap(([key, val]) => {
      const propLabel = propLabels[key as keyof TObject];
      return this.sgProperty(key, val, propLabel);
    });
    const permissions = Object.keys(input).flatMap((key) =>
      isRootSGMember ? this.rootSGPermission(key) : this.sgPermission(key)
    );
    try {
      const permissionQueries = isRootSGMember
        ? [
            [
              node('rootSG', 'RootSecurityGroup', {
                name: sgName + ' root',
                id: generate(),
              }),
              relation('out', '', 'member'),
              node('requestingUser'),
            ],
            ...permissions,
          ]
        : [
            [
              node('adminSG', 'SecurityGroup', {
                id: generate(),

                name: sgName + ' admin',
              }),
              relation('out', '', 'member'),
              node('requestingUser'),
            ],
            [
              node('readerSG', 'SecurityGroup', {
                id: generate(),

                name: sgName + ' users',
              }),
              relation('out', '', 'member'),
              node('requestingUser'),
            ],
            [node('adminSG'), relation('out', '', 'member'), node('rootuser')],
            [node('readerSG'), relation('out', '', 'member'), node('rootuser')],
            ...permissions,
          ];

      const query = this.db
        .query()
        .match(matchSession(session, { withAclEdit: aclEditPropName }))
        .match([
          node('rootuser', 'User', {
            id: this.config.rootAdmin.id,
          }),
        ])
        .create([
          [
            node('newNode', baseNode, {
              createdAt,
              id,
            }),
          ],
          ...properties,
          ...permissionQueries,
        ])
        .return('newNode.id as id');
      const result = await query.first();

      if (!result) {
        throw new ServerException('failed to create node');
      }
      return result.id;
    } catch (exception) {
      this.logger.error(`Could not create node`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException('Could not create node', exception);
    }
  }

  // helper method for defining properties
  sgProperty = (prop: string, value: any, propLabel: any) => {
    if (!value) {
      return [];
    }
    const createdAt = DateTime.local();
    const property = (propLabel as string)
      ? (propLabel as string) + ':Property'
      : 'Property';
    return [
      [
        node('newNode'),
        relation('out', '', prop, {
          active: true,
          createdAt,
        }),
        node(prop, property, {
          active: true,
          value,
        }),
      ],
    ];
  };

  // helper method for defining properties
  sgPermission = (property: string) => {
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
        node('newNode'),
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
        node('newNode'),
      ],
    ];
  };

  rootSGPermission = (property: string) => {
    const createdAt = DateTime.local();
    return [
      [
        node('rootSG'),
        relation('out', '', 'permission', {
          active: true,
          createdAt,
        }),
        node('', 'Permission', {
          property,
          active: true,
          read: true,
          edit: true,
          root: true,
        }),
        relation('out', '', 'baseNode', {
          active: true,
          createdAt,
        }),
        node('newNode'),
      ],
    ];
  };

  async sgReadOne({
    id,
    session,
    props,
    aclReadProp,
    aclEditProp,
    nodevar,
  }: {
    id: string;
    session: ISession;
    props: string[];
    aclReadProp?: string;
    aclEditProp?: string;
    nodevar: string;
  }): Promise<any | undefined> {
    const nodeName = upperFirst(nodevar);
    const aclReadPropName = aclReadProp || `canRead${nodeName}s`;
    const aclCreatePropName = aclEditProp || `canCreate${nodeName}`;
    const output = {
      node: [{ id: 'id', createdAt: 'createdAt' }],
      requestingUser: [
        {
          [aclReadPropName]: aclReadPropName,
          [aclCreatePropName]: aclCreatePropName,
        },
      ],
    };

    if (await this.isRootSecurityGroupMember(session)) {
      const rootOutput = {
        baseNode: [{ id: 'id', createdAt: 'createdAt' }],
      };
      const qry = this.db
        .query()
        .match([node('baseNode', nodeName, { id: id })]);
      for (const prop of props) {
        qry.optionalMatch([
          node('baseNode'),
          relation('out', 'rel', prop, { active: true }),
          node(prop, 'Property'),
        ]);
        Object.assign(rootOutput, { [prop]: [{ value: prop }] });
      }

      const rootResult = await qry.return(rootOutput).first();
      return {
        id: rootResult!.id,
        createdAt: rootResult!.createdAt,
        ...mapFromList(props, (prop) => {
          const val = {
            value: rootResult![prop],
            canRead: true,
            canEdit: true,
          };
          return [prop, val];
        }),
      };
    }
    const query = this.db
      .query()
      .match(matchSession(session, { withAclEdit: aclReadPropName }))
      .match([node('node', nodeName, { id: id })]);

    for (const property of props) {
      const readPerm = 'canRead' + upperFirst(property);
      const editPerm = 'canEdit' + upperFirst(property);
      query.optionalMatch([
        [
          node('requestingUser'),
          relation('in', '', 'member'),
          node('sg', 'SecurityGroup'),
          relation('out', '', 'permission'),
          node(editPerm, 'Permission', {
            property,

            edit: true,
          }),
          relation('out', '', 'baseNode'),
          node('node'),
          relation('out', '', property, { active: true }),
          node(property, 'Property'),
        ],
      ]);
      query.optionalMatch([
        [
          node('requestingUser'),
          relation('in', '', 'member'),
          node('sg', 'SecurityGroup'),
          relation('out', '', 'permission'),
          node(readPerm, 'Permission', {
            property,

            read: true,
          }),
          relation('out', '', 'baseNode'),
          node('node'),
          relation('out', '', property, { active: true }),
          node(property, 'Property'),
        ],
      ]);

      Object.assign(output, {
        [readPerm]: [{ read: readPerm }],
        [editPerm]: [{ edit: editPerm }],
      });
      Object.assign(output, { [property]: [{ value: property }] });
    }

    query.return(output);
    let result: any;
    try {
      result = await query.first();
    } catch (exception) {
      this.logger.error(`Could not find node`, {
        exception,
        userId: session.userId,
      });
      throw new ServerException('Could not find node', exception);
    }

    if (!result) {
      throw new InputException('Could not find node');
    }
    if (!result[aclCreatePropName]) {
      throw new UnauthorizedException(
        'User does not have permission to create an node'
      );
    }

    return {
      id: result.id,
      createdAt: result.createdAt,
      ...mapFromList(props, (property) => {
        const val = {
          value: result[property],
          canRead: !!result['canRead' + upperFirst(property)],
          canEdit: !!result['canEdit' + upperFirst(property)],
        };
        return [property, val];
      }),
    };
  }

  async isRootSecurityGroupMember(session: ISession): Promise<boolean> {
    const result = await this.db
      .query()
      .match([
        matchSession(session),
        [
          node('user', 'User', { active: true, id: session.userId }),
          relation('in', '', 'member'),
          node('rSg', 'RootSecurityGroup'),
        ],
      ])
      .return('count(user) as total')
      .first();

    return (result?.total || 0) > 0;
  }
}
