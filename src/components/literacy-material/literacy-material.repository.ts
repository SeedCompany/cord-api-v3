import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import { ID, NotFoundException, Session } from '../../common';
import { DtoRepository, matchRequestingUser } from '../../core';
import {
  createNode,
  paginate,
  permissionsOfNode,
  requestingUser,
  sorting,
} from '../../core/database/query';
import {
  CreateLiteracyMaterial,
  LiteracyMaterial,
  LiteracyMaterialListInput,
} from './dto';

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

  async create(session: Session, input: CreateLiteracyMaterial) {
    const initialProps = {
      name: input.name,
      canDelete: true,
    };
    return await this.db
      .query()
      .apply(matchRequestingUser(session))
      .apply(
        await createNode(LiteracyMaterial, {
          initialProps,
        })
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
