import { fieldZones } from '~/core/drizzle/schema';
import { type FieldZone } from '../../../components/field-zone/dto';
import { FieldZoneRepository } from '../../../components/field-zone/field-zone.repository';
import {
  bulkInsert,
  linkId,
  one,
  readAllViaRepo,
  tsReq,
} from '../cutover.helpers';
import { type Extractor } from '../cutover.types';

/** FieldZone — (name, director→user). directorId is NOT NULL. */
export const fieldZoneExtractor: Extractor = {
  name: 'fieldZone',
  targetTables: ['field_zones'],
  dependsOn: ['user'],
  async run(ctx) {
    const dtos = await readAllViaRepo<FieldZone>(
      ctx,
      'FieldZone',
      FieldZoneRepository,
    );
    const rows = dtos.map((z) => ({
      id: z.id,
      name: z.name,
      directorId: linkId(z.director)!,
      createdAt: tsReq(z.createdAt),
      updatedAt: tsReq(z.createdAt),
      deletedAt: null,
    }));
    return one(
      'field_zones',
      dtos.length,
      await bulkInsert(ctx, fieldZones, rows),
    );
  },
};
