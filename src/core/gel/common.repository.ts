import { Inject, Injectable } from '@nestjs/common';
import { EnhancedResource, type ID, isIdLike, type PublicOf } from '~/common';
import type { CommonRepository as Neo4jCommonRepository } from '~/core/database';
import {
  type ResourceLike,
  ResourcesHost,
} from '~/core/resources/resources.host';
import type { BaseNode } from '../database/results';
import { DbTraceLayer, Gel } from './gel.service';
import { e } from './reexports';

/**
 * This provides a few methods out of the box.
 */
@Injectable()
export class CommonRepository implements PublicOf<Neo4jCommonRepository> {
  @Inject() protected readonly db: Gel;
  @Inject() protected readonly resources: ResourcesHost;

  constructor() {
    DbTraceLayer.applyToInstance(this);
  }

  /**
   * Here for compatibility with the Neo4j version.
   * @deprecated this should be replaced with a different output shape,
   * after we finish migration.
   */
  async getBaseNode(id: ID, fqn?: ResourceLike): Promise<BaseNode | undefined> {
    const res = await this.getBaseNodes([id], fqn);
    return res[0];
  }

  /**
   * Here for compatibility with the Neo4j version.
   * @deprecated this should be replaced with a different output shape,
   * after we finish migration.
   */
  async getBaseNodes(
    ids: readonly ID[],
    fqn?: ResourceLike,
  ): Promise<readonly BaseNode[]> {
    const res = fqn
      ? typeof fqn === 'string'
        ? this.resources.getByGel(fqn)
        : EnhancedResource.of(fqn)
      : undefined;
    const query = e.params({ ids: e.array(e.uuid) }, ({ ids }) =>
      e.select(res?.db ?? e.Object, (obj) => ({
        id: true,
        // eslint-disable-next-line @typescript-eslint/naming-convention
        _typeFQN_: obj.__type__.name,
        createdAt: obj.is(e.Mixin.Timestamped).createdAt,
        filter: e.op(obj.id, 'in', e.array_unpack(ids)),
      })),
    );
    const nodes = await this.db.run(query, { ids });

    return nodes.map(
      (node): BaseNode => ({
        identity: node.id,
        labels: [this.resources.getByGel(node._typeFQN_).dbLabel],
        properties: {
          id: node.id,
          // Ignore that this could be missing for objects that aren't audited.
          // This I don't think is really used programmatically,
          // so it is only here to fulfill the shape.
          createdAt: node.createdAt!,
        },
      }),
    );
  }

  async deleteNode(
    objectOrId: { id: ID } | ID,
    { resource }: { changeset?: ID; resource?: ResourceLike } = {},
  ) {
    const id = isIdLike(objectOrId) ? objectOrId : objectOrId.id;
    const type = resource ? this.resources.enhance(resource).db : e.Object;
    const query = e.delete(type, () => ({
      filter_single: { id },
    }));
    await this.db.run(query);
  }
}
