import { Inject, Injectable } from '@nestjs/common';
import { EnhancedResource, ID, isIdLike, PublicOf } from '~/common';
import type { CommonRepository as Neo4jCommonRepository } from '~/core/database';
import { ResourceLike, ResourcesHost } from '~/core/resources/resources.host';
import type { BaseNode } from '../database/results';
import { EdgeDB } from './edgedb.service';
import { e } from './reexports';

/**
 * This provides a few methods out of the box.
 */
@Injectable()
export class CommonRepository implements PublicOf<Neo4jCommonRepository> {
  @Inject() protected readonly db: EdgeDB;
  @Inject() protected readonly resources: ResourcesHost;

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
        ? this.resources.getByEdgeDB(fqn)
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
        labels: [this.resources.getByEdgeDB(node._typeFQN_).dbLabel],
        properties: {
          id: node.id,
          createdAt: node.createdAt,
        },
      }),
    );
  }

  async deleteNode(objectOrId: { id: ID } | ID, _: { changeset?: ID } = {}) {
    const id = isIdLike(objectOrId) ? objectOrId : objectOrId.id;
    const query = e.delete(e.Object, () => ({
      filter_single: { id },
    }));
    await this.db.run(query);
  }
}
