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
  CreateFieldRegion,
  FieldRegion,
  FieldRegionListInput,
  TablesFieldRegions,
  TablesReadFieldRegion,
  UpdateFieldRegion,
} from './dto';

@Injectable()
export class FieldRegionRepository extends DtoRepository(FieldRegion) {
  async create(input: CreateFieldRegion, _session: Session) {
    const response = await getFromCordTables('sc/field-regions/create-read', {
      fieldRegion: {
        ...transformToPayload(input, CreateFieldRegion.TablesToDto),
      },
    });
    const iFieldRegion: TablesReadFieldRegion = JSON.parse(response.body);

    const dto: UnsecuredDto<FieldRegion> = transformToDto(
      iFieldRegion.fieldRegion,
      FieldRegion.TablesToDto
    );
    return dto;
  }

  async readOne(id: ID) {
    const response = await getFromCordTables('sc/field-regions/read', {
      id: id,
    });
    const fieldRegion = response.body;
    const iFieldRegion: TablesReadFieldRegion = JSON.parse(fieldRegion);

    const dto: UnsecuredDto<FieldRegion> = transformToDto(
      iFieldRegion.fieldRegion,
      FieldRegion.TablesToDto
    );
    return dto;
  }

  async update(
    fieldRegion: FieldRegion,
    updates: Partial<Omit<UpdateFieldRegion, 'id'>>
  ) {
    const updatePayload = transformToPayload(
      updates,
      UpdateFieldRegion.TablesToDto
    );
    Object.entries(updatePayload).forEach(([key, value]) => {
      void getFromCordTables('sc/field-regions/update', {
        id: fieldRegion.id,
        column: key,
        value: value,
      });
    });
  }

  async delete(fieldRegion: FieldRegion) {
    return await getFromCordTables('sc/field-regions/delete', {
      id: fieldRegion.id,
    });
  }

  async list({ filter, ...input }: FieldRegionListInput, _session: Session) {
    const response = await getFromCordTables('sc/field-regions/list', {
      sort: input.sort,
      order: input.order,
      page: input.page,
      resultsPerPage: input.count,
    });
    const fieldRegions = response.body;
    const iFieldRegions: TablesFieldRegions = JSON.parse(fieldRegions);

    const fieldRegionArray: Array<UnsecuredDto<FieldRegion>> =
      iFieldRegions.fieldRegions.map((fieldRegion) => {
        return transformToDto(fieldRegion, FieldRegion.TablesToDto);
      });
    const totalLoaded =
      input.count * (input.page - 1) + fieldRegionArray.length;
    const fieldRegionList: PaginatedListType<UnsecuredDto<FieldRegion>> = {
      items: fieldRegionArray,
      total: totalLoaded,
      hasMore: totalLoaded < iFieldRegions.size,
    };
    return fieldRegionList;
  }
}
