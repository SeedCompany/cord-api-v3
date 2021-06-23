import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { generateId, ID, Session } from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  calculateTotalAndPaginateList,
  matchPropList,
  permissionsOfNode,
  requestingUser,
} from '../../core/database/query';
import { DbPropsOfDto, StandardReadResult } from '../../core/database/results';
import { LiteracyMaterial, LiteracyMaterialListInput } from './dto';

@Injectable()
export class LiteracyMaterialRepository extends DtoRepository(
  LiteracyMaterial
) {
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
      .return<{ id: ID }>('node.id as id')
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
