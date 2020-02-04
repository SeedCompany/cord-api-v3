import { Connection, node, relation } from 'cypher-query-builder';
import {
  IRequestUser,
  UnwrapSecured,
  isSecured,
  unwrapSecured,
} from '../../common';
import { Injectable, NotFoundException } from '@nestjs/common';

import { DateTime } from 'luxon';
import { upperFirst } from 'lodash';

@Injectable()
export class PropertyUpdaterService {
  constructor(private readonly db: Connection) {}

  async updateProperties<TObject extends { id: string }>({
    token,
    object,
    props,
    changes,
  }: {
    token: IRequestUser;
    object: TObject;
    props: ReadonlyArray<keyof TObject>;
    changes: { [Key in keyof TObject]?: UnwrapSecured<TObject[Key]> };
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
      });
    }
    return updated;
  }

  async updateProperty<
    TObject extends { id: string },
    Key extends keyof TObject
  >({
    token,
    object,
    key,
    value,
    aclEditProp,
  }: {
    token: IRequestUser;
    object: TObject;
    key: Key;
    value: UnwrapSecured<TObject[Key]>;
    aclEditProp?: string;
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
        node('user', 'User', {
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
        node('user'),
        relation('out', 'oldToProp', key as string, { active: true }),
        node('oldPropVar', 'Property', { active: true }),
      ])
      .setValues({
        'oldToProp.active': false,
        'oldPropVar.active': false,
      })
      .create([
        node('user'),
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
