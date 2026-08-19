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
    // Both links are OPTIONAL-matched by the hydrate and both columns are NOT
    // NULL — same trap as the field zone above, and the same reasoning for failing
    // instead of dropping: a region carries its projects with it.
    const incomplete = dtos.filter(
      (r) => !linkId(r.fieldZone) || !linkId(r.director),
    );
    if (incomplete.length > 0) {
      throw new Error(
        `Cutover: ${incomplete.length} FieldRegion(s) are missing a live field zone or ` +
          `director, and both columns are NOT NULL: ${incomplete
            .map((r) => r.id)
            .join(
              ', ',
            )}. Fix in Neo4j before loading — dropping them here would ` +
          `take every project beneath them.`,
      );
    }
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
