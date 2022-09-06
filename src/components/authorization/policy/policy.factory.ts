import {
  DiscoveredClassWithMeta,
  DiscoveryService,
} from '@golevelup/nestjs-discovery';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { mapValues, startCase } from 'lodash';
import { DeepWritable, Writable } from 'ts-essentials';
import { many } from '~/common';
import { Role } from '../dto/role.dto';
import { ResourceMap } from '../model/resource-map';
import { Action, Permission, Permissions } from './builder/perm-granter';
import {
  POLICY_METADATA_KEY,
  PolicyMetadata,
} from './builder/policy.decorator';
import {
  ResourceGranterImpl,
  ResourcesGranter,
} from './builder/resource-granter';
import { Condition, OrConditions } from './conditions';
import { ResourcesHost } from './resources.host';

export interface Policy {
  /* Policy Name */
  name: string;
  /* Only applies to these roles */
  roles?: readonly Role[];
  /* What the policy grants */
  grants: Map<
    keyof ResourceMap,
    {
      objectLevel: Permissions;
      propLevel: Readonly<Partial<Record<string, Permissions>>>;
    }
  >;
}

@Injectable()
export class PolicyFactory implements OnModuleInit {
  private policies?: Policy[];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly resourcesHost: ResourcesHost
  ) {}

  getPolicies() {
    if (!this.policies) {
      throw new Error('Policies are not available yet.');
    }
    return this.policies;
  }

  async onModuleInit() {
    const discoveredPolicies =
      await this.discovery.providersWithMetaAtKey<PolicyMetadata>(
        POLICY_METADATA_KEY
      );

    const ResourceMap = await this.resourcesHost.getMap();
    const resGranter = mapValues(
      ResourceMap,
      (resource) => new ResourceGranterImpl(resource)
    ) as unknown as ResourcesGranter; // key/value association is being messed up

    this.policies = await Promise.all(
      discoveredPolicies.map((discovered) =>
        this.buildPolicy(resGranter, discovered)
      )
    );
  }

  async buildPolicy(
    resGranter: ResourcesGranter,
    { meta, discoveredClass }: DiscoveredClassWithMeta<PolicyMetadata>
  ): Promise<Policy> {
    const roles = meta.role === 'all' ? undefined : many(meta.role);
    const grants: DeepWritable<Policy['grants']> = new Map();
    const resultList = meta.def(resGranter);
    for (const resourceGrant of resultList) {
      const { resource, perms, props } = (
        resourceGrant as ResourceGranterImpl<any>
      ).extract();
      const resName = resource.name as keyof ResourceMap;
      if (!grants.has(resName)) {
        grants.set(resName, {
          objectLevel: {},
          propLevel: {},
        });
      }
      const { objectLevel, propLevel } = grants.get(resName)!;
      this.mergePermissions(objectLevel, perms);
      for (const prop of props) {
        for (const propName of prop.properties) {
          const propPerms = (propLevel[propName] ??= {});
          this.mergePermissions(propPerms, prop.perms);
        }
      }

      const implementations = await this.resourcesHost.getImplementations(
        resource
      );
      for (const implementation of implementations) {
        const implName = implementation.name as keyof ResourceMap;
        if (!grants.has(implName)) {
          // If policy doesn't specify this implementation then use interface grant
          grants.set(implName, grants.get(resName)!);
        }
      }
    }

    const name = startCase(discoveredClass.name.replace(/Policy$/, ''));
    return { name, roles, grants };
  }

  private mergePermissions(
    existing: Writable<Permissions>,
    toMerge: Permissions
  ) {
    for (const [action, perm] of Object.entries(toMerge) as Array<
      [Action, Permission | true]
    >) {
      if (perm === true || existing[action] === true) {
        existing[action] = true;
        continue;
      }
      if (!existing[action]) {
        existing[action] = perm;
        continue;
      }

      // This could result in duplicates entries for the same condition.
      // An optimization would be to de-dupe those.
      existing[action] = new OrConditions([
        existing[action] as Condition<any>,
        perm,
      ]);
    }

    return existing;
  }
}
