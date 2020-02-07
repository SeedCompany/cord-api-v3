import { Connection, node, relation } from 'cypher-query-builder';
import {
  IRequestUser,
  UnwrapSecured,
  isSecured,
  unwrapSecured,
  Resource,
} from '../../common';
import { Injectable, NotFoundException } from '@nestjs/common';

import { DateTime } from 'luxon';
import { upperFirst } from 'lodash';

@Injectable()
export class PropertyUpdaterService {
  constructor(private readonly db: Connection) {}

  async updateProperties<TObject extends Resource>({
    token,
    object,
    props,
    changes,
    nodevar,
  }: {
    token: IRequestUser;
    object: TObject;
    props: ReadonlyArray<keyof TObject>;
    changes: { [Key in keyof TObject]?: UnwrapSecured<TObject[Key]> };
    nodevar: string;
  }) {
    let updated = object;
    for (const prop of props) {
      if (
        changes[prop] == null ||
        unwrapSecured(object[prop]) === changes[prop]
      ) {
        continue;
      }
      updated = await this.updateProperty({
        object,
        token,
        key: prop,
        value: changes[prop],
        nodevar,
      });
    }
    return updated;
  }

  async updateProperty<TObject extends Resource, Key extends keyof TObject>({
    token,
    object,
    key,
    value,
    aclEditProp,
    nodevar,
  }: {
    token: IRequestUser;
    object: TObject;
    key: Key;
    value: UnwrapSecured<TObject[Key]>;
    aclEditProp?: string;
    nodevar: string;
  }): Promise<TObject> {
    const aclEditPropName =
      aclEditProp || `canEdit${upperFirst(key as string)}`;

    const now = DateTime.local().toNeo4JDateTime();
    const result = await this.db
      .query()
      .match([
        node('token', 'Token', {
          active: true,
          value: token.token,
        }),
        relation('in', '', 'token', {
          active: true,
        }),
        node('requestingUser', 'User', {
          active: true,
          id: token.userId,
        }),
      ])
      .with('*')
      .optionalMatch([
        node(nodevar, upperFirst(nodevar), {
          active: true,
          id: object.id,
          owningOrgId: token.owningOrgId,
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
        node('oldPropVar', 'Property', { active: true }),
      ])
      .setValues({
        'oldToProp.active': false,
        'oldPropVar.active': false,
      })
      .create([
        node(nodevar),
        relation('out', 'toProp', key as string, {
          active: true,
          createdAt: now,
        }),
        node('newPropNode', 'Property', {
          active: true,
          createdAt: now,
          value,
        }),
      ])
      .return('newPropNode')
      .first();

    if (!result) {
      throw new NotFoundException('Could not find object');
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
}
