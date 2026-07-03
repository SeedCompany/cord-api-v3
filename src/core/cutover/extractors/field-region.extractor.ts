import { fieldRegions } from '~/core/drizzle/schema';
import { type FieldRegion } from '../../../components/field-region/dto';
import { FieldRegionRepository } from '../../../components/field-region/field-region.repository';
import {
  bulkInsert,
  linkId,
  one,
  readAllViaRepo,
  tsReq,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/** FieldRegion — (name, fieldZone, director→user). Both FKs NOT NULL. */
export const fieldRegionExtractor: Extractor = {
  name: 'fieldRegion',
  targetTables: ['field_regions'],
  dependsOn: ['fieldZone', 'user'],
  async run(ctx) {
    const dtos = await readAllViaRepo<FieldRegion>(
      ctx,
      'FieldRegion',
      FieldRegionRepository,
    );
    const rows = dtos.map((r) => ({
      id: r.id,
      name: r.name,
      fieldZoneId: linkId(r.fieldZone)!,
      directorId: linkId(r.director)!,
      createdAt: tsReq(r.createdAt),
      updatedAt: tsReq(r.createdAt),
      deletedAt: null,
    }));
    return one(
      'field_regions',
      dtos.length,
      await bulkInsert(ctx, fieldRegions, rows),
    );
  },
};
