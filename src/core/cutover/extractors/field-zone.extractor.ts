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
    // `director` is OPTIONAL-matched by the repository's hydrate, so a zone whose
    // director user was soft-deleted arrives as null — and `director_id` is NOT
    // NULL. Written unchecked (it used to be `linkId(z.director)!`) that becomes a
    // null-violation raised from inside the driver, naming a column and nothing
    // else, part-way through the load.
    //
    // Deliberately fails the run rather than dropping the row: a FieldZone sits at
    // the root of the dependency graph, so dropping one silently takes its field
    // regions, their projects and everything below. There are only a handful of
    // zones, and a director-less zone is a source-data fix, not a shape the load
    // should quietly absorb.
    const directorless = dtos.filter((z) => !linkId(z.director));
    if (directorless.length > 0) {
      throw new Error(
        `Cutover: ${directorless.length} FieldZone(s) have no live director, and ` +
          `field_zones.director_id is NOT NULL: ${directorless
            .map((z) => z.id)
            .join(
              ', ',
            )}. Assign a director (or restore the deleted user) in Neo4j ` +
          `before loading — dropping them here would take every field region and ` +
          `project beneath them.`,
      );
    }
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
