import { Injectable } from '@nestjs/common';
import { node, Query } from 'cypher-query-builder';
import {
  generateId,
  ID,
  NotFoundException,
  Session,
  UnsecuredDto,
} from '../../common';
import {
  createBaseNode,
  DtoRepository,
  matchRequestingUser,
  Property,
} from '../../core';
import {
  matchProps,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
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
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'LiteracyMaterial', { id })])
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find literacy material',
        'literacyMaterial.id'
      );
    }
    return result.dto;
  }

  private hydrate() {
    return (query: Query) =>
      query
        .apply(matchProps())
        .return<{ dto: UnsecuredDto<LiteracyMaterial> }>('props as dto');
  }

  async list(input: LiteracyMaterialListInput, session: Session) {
    const result = await this.db
      .query()
      .match([
        requestingUser(session),
        ...permissionsOfNode('LiteracyMaterial'),
      ])
      .apply(sorting(LiteracyMaterial, input))
      .apply(paginate(input))
      .first();
    return result!; // result from paginate() will always have 1 row.
  }
}
