import {
  DiscoveredClassWithMeta,
  DiscoveryService,
} from '@golevelup/nestjs-discovery';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { mapValues, startCase } from 'lodash';
import { DeepWritable, Writable } from 'ts-essentials';
import { many } from '~/common';
import { Powers as Power } from '../dto/powers';
import { Role } from '../dto/role.dto';
import { ResourceMap } from '../model/resource-map';
import { Permission, Permissions } from './builder/perm-granter';
import {
  POLICY_METADATA_KEY,
  PolicyMetadata,
} from './builder/policy.decorator';
import {
  ResourceGranterImpl,
  ResourcesGranter,
} from './builder/resource-granter';
import { any } from './conditions';
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
      objectLevel: Permissions<string>;
      propLevel: Readonly<Partial<Record<string, Permissions<string>>>>;
      childRelations: Readonly<Partial<Record<string, Permissions<string>>>>;
    }
  >;
  /* An optimization to determine Powers this policy contains */
  powers: Set<Power>;
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
    const resultList = many(meta.def(resGranter));
    for (const resourceGrant of resultList) {
      const { resource, perms, props, childRelationships } = (
        resourceGrant as ResourceGranterImpl<any>
      ).extract();
      const resName = resource.name as keyof ResourceMap;
      if (!grants.has(resName)) {
        grants.set(resName, {
          objectLevel: {},
          propLevel: {},
          childRelations: {},
        });
      }
      const { objectLevel, propLevel, childRelations } = grants.get(resName)!;
      this.mergePermissions(objectLevel, perms);
      for (const prop of props) {
        for (const propName of prop.properties) {
          const propPerms = (propLevel[propName] ??= {});
          this.mergePermissions(propPerms, prop.perms);
        }
      }
      for (const childRelation of childRelationships) {
        for (const relationName of childRelation.relationNames) {
          const childPerms = (childRelations[relationName] ??= {});
          this.mergePermissions(childPerms, childRelation.perms);
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
    const powers = await this.determinePowers(grants);
    return { name, roles, grants, powers };
  }

  private mergePermissions<TAction extends string>(
    existing: Writable<Permissions<TAction>>,
    toMerge: Permissions<TAction>
  ) {
    for (const [action, perm] of Object.entries(toMerge) as Array<
      [TAction, Permission | true]
    >) {
      existing[action] = this.mergePermission(perm, existing[action]);
    }

    return existing;
  }

  private mergePermission(perm: Permission, prev?: Permission) {
    if (perm === true || prev === true) {
      return true;
    }
    if (!prev) {
      return perm;
    }

    // This could result in duplicates entries for the same condition.
    // An optimization would be to de-dupe those.
    return any(prev, perm);
  }

  private async determinePowers(grants: Policy['grants']) {
    const powers = new Set<Power>();
    const pushPower = (str: string) => {
      const power = `Create${str}`;
      // verify actually defined as a power
      if (power in Power) {
        powers.add(power as Power);
      }
    };
    for (const [res, grant] of grants.entries()) {
      // Only looking for global create access, powers cannot be conditional.
      if (grant.objectLevel.create !== true) {
        continue;
      }
      pushPower(res);

      const implementations = await this.resourcesHost.getImplementations(res);
      for (const implementation of implementations) {
        const implName = implementation.name as keyof ResourceMap;
        if (grants.has(implName)) {
          // If policy specifies this implementation then defer to its entry.
          continue;
        }
        pushPower(implName);
      }
    }
    return powers;
  }
}
