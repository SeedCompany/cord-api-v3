import { Injectable } from '@nestjs/common';
import { type DateTime } from 'luxon';
import { type ID, NotImplementedException, type PublicOf } from '~/common';
import type { BaseNode } from '~/core/neo4j/results';
import { type ResourceLike } from '~/core/resources/resources.host';
import { type PnpExtractionResult } from './extraction-result.dto';
import { type PnpExtractionResultRepository } from './pnp-extraction-result.gel.repository';

/**
 * No Postgres storage exists yet for PnP extraction results (this domain was
 * never migrated off Neo4j into Gel either, so there's nothing to port) --
 * `read()` truthfully reports "no result" for every file rather than
 * `splitDb()`'s prior fallback to the Gel stub, which unconditionally threw
 * and broke the entire `engagement` query (see PnpExtractionResultLoader).
 * Everything else still throws: silently faking a save/delete, or a generic
 * base-node lookup nothing in this domain actually calls, would hide bugs
 * rather than surface them.
 */
@Injectable()
export class PnpExtractionResultDrizzleRepository implements PublicOf<PnpExtractionResultRepository> {
  async read(files: ReadonlyArray<ID<'File'>>) {
    return files.map((id) => ({ id, result: null }));
  }

  async save(file: ID<'FileVersion'>, result: PnpExtractionResult) {
    throw new NotImplementedException().with(file, result);
  }

  async getBaseNode(id: ID, fqn?: ResourceLike): Promise<BaseNode | undefined> {
    throw new NotImplementedException().with(id, fqn);
  }

  async getBaseNodes(
    ids: readonly ID[],
    fqn?: ResourceLike,
  ): Promise<readonly BaseNode[]> {
    throw new NotImplementedException().with(ids, fqn);
  }

  async deleteNode(
    objectOrId: { id: ID } | ID,
    options?: { changeset?: ID; resource?: ResourceLike },
  ): Promise<{ at: DateTime }> {
    throw new NotImplementedException().with(objectOrId, options);
  }
}
