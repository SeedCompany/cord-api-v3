import { Injectable } from '@nestjs/common';
import { node } from 'cypher-query-builder';
import {
  getFromCordTables,
  ID,
  NotFoundException,
  Sensitivity,
  Session,
  transformEthnologueDtoToPayload,
  transformEthnologuePayloadToDto,
  UnsecuredDto,
} from '../../../common';
import { DtoRepository, matchRequestingUser } from '../../../core';
import {
  CreateEthnologueLanguage,
  EthnologueLanguage,
  TablesReadEthnologue,
} from '../dto';

@Injectable()
export class EthnologueLanguageRepository extends DtoRepository(
  EthnologueLanguage
) {
  async create(eth: CreateEthnologueLanguage, sensitivity: Sensitivity) {
    const response = await getFromCordTables('sc/ethnologue/create-read', {
      ethnologue: { ...transformEthnologueDtoToPayload(eth, sensitivity) },
    });
    const iLanguage: TablesReadEthnologue = JSON.parse(response.body);

    const dto: UnsecuredDto<EthnologueLanguage> =
      transformEthnologuePayloadToDto(iLanguage.ethnologue);
    return dto.id;
  }

  async readOne(id: ID, session: Session) {
    const query = this.db
      .query()
      .apply(matchRequestingUser(session))
      .match([node('node', 'EthnologueLanguage', { id: id })])
      .apply(this.hydrate());

    const result = await query.first();
    if (!result) {
      throw new NotFoundException(
        'Could not find ethnologue language',
        'ethnologue.id'
      );
    }
    return result.dto;
  }
}
