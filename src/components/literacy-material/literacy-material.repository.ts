import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { DateTime } from 'luxon';
import {
  createBaseNode,
  DatabaseService,
  matchRequestingUser,
  Property,
} from '../../core';

import { Session, ID, generateId } from '../../common';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';

import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbChanges } from '../../core/database/changes';

import {
  LiteracyMaterial,
  LiteracyMaterialListInput,
  UpdateLiteracyMaterial,
} from './dto';

@Injectable()
export class LiteracyMaterialRepository {
  constructor(private readonly db: DatabaseService) {}

  async checkLiteracy(name: string) {
    return await this.db
      .query()
      .match([node('literacyMaterial', 'LiteracyName', { value: name })])
      .return('literacyMaterial')
      .first();
  }

  async create(session: Session, name: string) {
    const secureProps: Property[] = [
      {
        key: 'name',
        value: name,
        isPublic: true,
        isOrgPublic: true,
        label: 'LiteracyName',
      },
      {
        key: 'canDelete',
        value: true,
        isPublic: false,
        isOrgPublic: false,
      },
    ];
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(
        createBaseNode(
          await generateId(),
          ['LiteracyMaterial', 'Producible'],
          secureProps
        )
      )
      .return('node.id as id')
      .first();
  }

  async readOne(id: ID, session: Session) {
    const readLiteracyMaterial = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'LiteracyMaterial', { id })])
      .apply(matchPropList)
      .return('node, propList')
      .asResult<StandardReadResult<DbPropsOfDto<LiteracyMaterial>>>();

    return await readLiteracyMaterial.first();
  }

  async checkDeletePermission(id: ID, session: Session) {
    return await this.db.checkDeletePermission(id, session);
  }

  getActualChanges(
    literacyMaterial: LiteracyMaterial,
    input: UpdateLiteracyMaterial
  ) {
    return this.db.getActualChanges(LiteracyMaterial, literacyMaterial, input);
  }

  async updateProperties(
    object: LiteracyMaterial,
    changes: DbChanges<LiteracyMaterial>
  ) {
    await this.db.updateProperties({
      type: LiteracyMaterial,
      object,
      changes,
    });
  }

  async deleteNode(node: LiteracyMaterial) {
    await this.db.deleteNode(node);
  }
  list({ filter, ...input }: LiteracyMaterialListInput, session: Session) {
    return this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('LiteracyMaterial'),
      ])
      .apply(calculateTotalAndPaginateList(LiteracyMaterial, input));
  }
}
