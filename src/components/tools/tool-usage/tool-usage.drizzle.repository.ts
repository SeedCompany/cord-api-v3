import { Inject, Injectable } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  EnhancedResource,
  type ID,
  NotFoundException,
  NotImplementedException,
  type PublicOf,
  type ResourceShape,
} from '~/common';
import { getChanges } from '~/core/database/changes';
import { type BaseNode } from '~/core/neo4j/results';
import { type ResourceLike } from '~/core/resources';
import { Privileges } from '../../authorization';
import { type ToolContainerType, ToolUsage } from './dto';
import { type ToolUsageRepository as Neo4jRepository } from './tool-usage.neo4j.repository';

/**
 * No Postgres storage exists yet for tool usages -- this domain was never
 * migrated off Neo4j into Gel either (`splitDb` only registers a `gel`
 * override, so Postgres mode fell through to running real Cypher queries
 * against an empty/disconnected Neo4j, surfacing as a generic "Could not
 * find ToolUsageByContainer" loader error and blocking the whole engagement
 * page). Read paths truthfully report "no usages recorded" for every
 * container/tool rather than erroring, matching what's actually true today.
 * Write paths and the deprecated generic BaseNode/delete compat shims (never
 * called by this domain's own code) still throw: faking those would hide
 * bugs or lose data instead of surfacing the real gap.
 */
@Injectable()
export class ToolUsageDrizzleRepository implements PublicOf<Neo4jRepository> {
  @Inject() private readonly privilegesService: Privileges;
  private readonly resource = EnhancedResource.of(ToolUsage);

  get privileges() {
    return this.privilegesService.forResource(ToolUsage);
  }

  getActualChanges = getChanges(ToolUsage);

  async listForContainers(containers: readonly ID[]) {
    return containers.map((id) => ({
      // `properties.createdAt` isn't read by ToolUsageService.readManyForContainers
      // (only `.properties.id`, to match rows back to the requested containers)
      // so this placeholder is never actually consumed.
      container: {
        identity: id,
        labels: [],
        properties: { id, createdAt: DateTime.now() },
      },
      usages: [],
    }));
  }

  async listForTools(tools: readonly ID[], _containerType?: ToolContainerType) {
    return tools.map((id) => ({ tool: { id }, usages: [] }));
  }

  async containerSummaryForTools(_tools: readonly ID[]) {
    return [];
  }

  async usageFor(_container: ID<'Resource'>, _tool: ID<'Tool'>) {
    return null;
  }

  async isUnique(_value: string, _label?: string): Promise<boolean> {
    throw new NotImplementedException();
  }

  async readOne(_id: ID): Promise<never> {
    // readMany always reports nothing found, matching the base
    // DtoRepositoryClass's readOne behavior in that case.
    throw new NotFoundException('Could not find tool usage');
  }

  async readMany(_ids: readonly ID[]) {
    return [];
  }

  async getBaseNode(
    id: ID,
    label?: string | ResourceShape<any>,
  ): Promise<BaseNode | undefined> {
    throw new NotImplementedException().with(id, label);
  }

  async getBaseNodes(
    ids: readonly ID[],
    label?: string | ResourceShape<any>,
  ): Promise<readonly BaseNode[]> {
    throw new NotImplementedException().with(ids, label);
  }

  async deleteNode(
    objectOrId: { id: ID } | ID,
    options?: { changeset?: ID; resource?: ResourceLike },
  ): Promise<{ at: DateTime }> {
    throw new NotImplementedException().with(objectOrId, options);
  }

  async create(...args: unknown[]): Promise<never> {
    throw new NotImplementedException().with(args);
  }

  async update(...args: unknown[]): Promise<never> {
    throw new NotImplementedException().with(args);
  }
}
