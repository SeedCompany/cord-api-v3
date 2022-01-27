import { Injectable } from '@nestjs/common';
import {
  getFromCordTables,
  ID,
  PaginatedListType,
  Session,
  transformToDto,
  transformToPayload,
  UnsecuredDto,
} from '../../common';
import { DtoRepository } from '../../core';
import {
  CreateFieldZone,
  FieldZone,
  FieldZoneListInput,
  UpdateFieldZone,
} from './dto';
import {
  TablesFieldZones,
  TablesReadFieldZone,
} from './dto/tables-field-zone.dto';

@Injectable()
export class FieldZoneRepository extends DtoRepository(FieldZone) {
  async create(input: CreateFieldZone, _session: Session) {
    const response = await getFromCordTables('sc/field-zones/create-read', {
      fieldZone: {
        ...transformToPayload(input, FieldZone.TablesToDto),
      },
    });
    const iFieldZone: TablesReadFieldZone = JSON.parse(response.body);

    const dto: UnsecuredDto<FieldZone> = transformToDto(
      iFieldZone.fieldZone,
      FieldZone.TablesToDto
    );
    return dto;
  }

  async readOne(id: ID) {
    const response = await getFromCordTables('sc/field-zones/read', {
      id: id,
    });
    const fieldZone = response.body;
    const iFieldZone: TablesReadFieldZone = JSON.parse(fieldZone);

    const dto: UnsecuredDto<FieldZone> = transformToDto(
      iFieldZone.fieldZone,
      FieldZone.TablesToDto
    );
    return dto;
  }

  async update(
    fieldZone: FieldZone,
    updates: Partial<Omit<UpdateFieldZone, 'id'>>
  ) {
    const updatePayload = transformToPayload(updates, FieldZone.TablesToDto);
    Object.entries(updatePayload).forEach(([key, value]) => {
      void getFromCordTables('sc/field-zones/update', {
        id: fieldZone.id,
        column: key,
        value: value,
      });
    });
  }

  async delete(fieldZone: FieldZone) {
    return await getFromCordTables('sc/field-zones/delete', {
      id: fieldZone.id,
    });
  }

  async list({ filter, ...input }: FieldZoneListInput, _session: Session) {
    const response = await getFromCordTables('sc/field-zones/list', {
      sort: input.sort,
      order: input.order,
      page: input.page,
      resultPerPage: input.count,
    });
    const fieldZones = response.body;
    const iFieldZones: TablesFieldZones = JSON.parse(fieldZones);

    const fieldZoneArray: Array<UnsecuredDto<FieldZone>> =
      iFieldZones.fieldZones.map((fieldZone) => {
        return transformToDto(fieldZone, FieldZone.TablesToDto);
      });
    const totalLoaded = input.count * (input.page - 1) + fieldZoneArray.length;
    const fieldZoneList: PaginatedListType<UnsecuredDto<FieldZone>> = {
      items: fieldZoneArray,
      total: totalLoaded,
      hasMore: totalLoaded < iFieldZones.size,
    };
    return fieldZoneList;
  }
}
