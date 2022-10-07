import {
  DiscoveredClassWithMeta,
  DiscoveryService,
} from '@golevelup/nestjs-discovery';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { pick, startCase } from 'lodash';
import { DeepWritable, Writable } from 'ts-essentials';
import { keys as keysOf } from 'ts-transformer-keys';
import { EnhancedResource, many, mapFromList } from '~/common';
import { ResourcesHost } from '~/core/resources';
import { Powers as Power } from '../dto/powers';
import { Role } from '../dto/role.dto';
import { ChildListAction, ChildSingleAction } from './actions';
import { extract, Permission, Permissions } from './builder/perm-granter';
import {
  POLICY_METADATA_KEY,
  PolicyMetadata,
} from './builder/policy.decorator';
import { ResourceGranter, ResourcesGranter } from './builder/resource-granter';
import { all, any, Condition } from './conditions';

interface ResourceGrants {
  objectLevel: Permissions<string>;
  propLevel: Readonly<Partial<Record<string, Permissions<string>>>>;
  childRelations: Readonly<Partial<Record<string, Permissions<string>>>>;
}
type Grants = ReadonlyMap<EnhancedResource<any>, ResourceGrants>;
type WritableGrants = Map<EnhancedResource<any>, DeepWritable<ResourceGrants>>;

export interface Policy {
  /* Policy Name */
  name: string;
  /* Only applies to these roles */
  roles?: readonly Role[];
  /* What the policy grants */
  grants: Grants;
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

    const ResourceMap = await this.resourcesHost.getEnhancedMap();
    const resGranter = ResourceGranter.create(ResourceMap);

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
    const grants: WritableGrants = new Map();
    const resultList = many(meta.def(resGranter));
    for (const resourceGrant of resultList) {
      const { resource, perms, props, childRelationships } =
        resourceGrant[extract]();
      if (!grants.has(resource)) {
        grants.set(resource, {
          objectLevel: {},
          propLevel: {},
          childRelations: {},
        });
      }
      const { objectLevel, propLevel, childRelations } = grants.get(resource)!;
      perms.forEach((objPerms) => this.mergePermissions(objectLevel, objPerms));
      for (const prop of props) {
        for (const propName of prop.properties) {
          const propPerms = (propLevel[propName] ??= {});
          prop.perms.forEach((perms) =>
            this.mergePermissions(propPerms, perms)
          );
        }
      }
      for (const childRelation of childRelationships) {
        for (const relationName of childRelation.relationNames) {
          const childPerms = (childRelations[relationName] ??= {});
          childRelation.perms.forEach((perms) =>
            this.mergePermissions(childPerms, perms)
          );
        }
      }
    }

    await this.defaultInterfacesFromImplementationsIntersection(grants);
    await this.defaultImplementationsFromInterfaces(grants);
    await this.defaultRelationEdgesToResourceLevel(grants);

    const powers = await this.determinePowers(grants);

    const name = startCase(discoveredClass.name.replace(/Policy$/, ''));
    const policy: Policy = { name, roles, grants, powers };
    this.attachPolicyToConditions(policy);

    return policy;
  }

  /**
   * Declare permissions of missing interfaces based on the intersection of
   * the permissions of its implementations
   */
  private async defaultInterfacesFromImplementationsIntersection(
    grantMap: WritableGrants
  ) {
    const interfaceCandidates = new Set(
      (
        await Promise.all(
          [...grantMap.keys()].map((res) =>
            this.resourcesHost.getInterfaces(res)
          )
        )
      ).flat()
    );

    const allKeysOf = (list: Array<object | undefined>) =>
      new Set(list.flatMap((itemObj) => (itemObj ? Object.keys(itemObj) : [])));

    const intersectPermissions = (
      perms: Array<Permissions<string> | undefined>
    ): Permissions<string> =>
      mapFromList(allKeysOf(perms), (action) => {
        const implActions = perms.map((g) => g?.[action] ?? false);
        const perm = this.mergePermission(implActions, all);
        return perm ? [action, perm] : null;
      });

    for (const interfaceRes of interfaceCandidates) {
      // Skip if policy already defines
      if (grantMap.has(interfaceRes)) {
        continue;
      }

      const impls = await this.resourcesHost.getImplementations(interfaceRes);

      // Skip if policy doesn't specify all implementations of the interface
      if (!(impls.length > 0 && impls.every((impl) => grantMap.has(impl)))) {
        continue;
      }

      const implGrants = impls.map((impl) => grantMap.get(impl)!);
      const objectLevelPermissions = implGrants.map((g) => g.objectLevel);
      const propLevelPermissions = implGrants.map((g) => g.propLevel);
      const childRelationPermissions = implGrants.map((g) => g.childRelations);

      const interfaceGrants: ResourceGrants = {
        objectLevel: intersectPermissions(objectLevelPermissions),
        propLevel: mapFromList(allKeysOf(propLevelPermissions), (prop) => {
          const perms = intersectPermissions(
            propLevelPermissions.map((propLevel) => propLevel[prop])
          );
          return [prop, perms];
        }),
        childRelations: mapFromList(
          allKeysOf(childRelationPermissions),
          (prop) => {
            const perms = intersectPermissions(
              childRelationPermissions.map((propLevel) => propLevel[prop])
            );
            return [prop, perms];
          }
        ),
      };

      grantMap.set(interfaceRes, interfaceGrants);
    }
  }

  private attachPolicyToConditions(policy: Policy) {
    const grants = policy.grants as WritableGrants;
    for (const { objectLevel, propLevel, childRelations } of grants.values()) {
      for (const [action, perm] of Object.entries(objectLevel)) {
        if (perm && typeof perm !== 'boolean') {
          objectLevel[action] = perm.attachPolicy?.(policy) ?? perm;
        }
      }
      for (const [prop, actions] of Object.entries(propLevel)) {
        for (const [action, perm] of Object.entries(actions ?? {})) {
          if (perm && typeof perm !== 'boolean') {
            propLevel[prop]![action] = perm.attachPolicy?.(policy) ?? perm;
          }
        }
      }
      for (const [rel, actions] of Object.entries(childRelations)) {
        for (const [action, perm] of Object.entries(actions ?? {})) {
          if (perm && typeof perm !== 'boolean') {
            childRelations[rel]![action] = perm.attachPolicy?.(policy) ?? perm;
          }
        }
      }
    }
  }

  private async defaultImplementationsFromInterfaces(grants: WritableGrants) {
    for (const resource of grants.keys()) {
      const impls = await this.resourcesHost.getImplementations(resource);
      for (const impl of impls) {
        if (grants.has(impl)) {
          continue;
        }
        // If policy doesn't specify this implementation then use most specific
        // interface given.
        const interfaceToApply = (
          await this.resourcesHost.getInterfaces(impl)
        ).find((i) => grants.has(i));
        const interfacePerms = interfaceToApply && grants.get(interfaceToApply);
        if (!interfacePerms) {
          // Safety check, but this shouldn't ever happen, since we only got
          // here from an interface used in the policy.
          continue;
        }
        grants.set(impl, interfacePerms);
      }
    }
  }

  private async defaultRelationEdgesToResourceLevel(grants: WritableGrants) {
    for (const [resource, { childRelations }] of grants.entries()) {
      for (const rel of resource.relations.values()) {
        const type = rel.resource;

        if (
          childRelations[rel.name] || // already defined
          !type || // safety check
          !grants.has(type) // policy doesn't define resource level
        ) {
          continue;
        }

        const childActions = rel.list
          ? keysOf<Record<ChildListAction, any>>()
          : keysOf<Record<ChildSingleAction, any>>();

        this.mergePermissions(
          (childRelations[rel.name] ??= {}),
          pick(grants.get(type)!.objectLevel, childActions)
        );
      }
    }
  }

  private mergePermissions<TAction extends string>(
    existing: Writable<Permissions<TAction>>,
    toMerge: Permissions<TAction>
  ) {
    for (const [action, perm] of Object.entries(toMerge) as Array<
      [TAction, Permission]
    >) {
      existing[action] = this.mergePermission([perm, existing[action]], any);
    }
    return existing;
  }

  private mergePermission(
    perms: ReadonlyArray<Permission | undefined>,
    mergeConditions: (...conditions: Array<Condition<any>>) => Condition<any>
  ): Permission | undefined {
    const cleaned = perms.filter((p): p is Permission => p != null);
    if (cleaned.length === 0) {
      return undefined;
    }
    if (cleaned.length === 1) {
      return perms[0];
    }
    if (cleaned.some((perm) => perm === false)) {
      return false;
    }
    if (cleaned.some((perm) => perm === true)) {
      return true;
    }
    // Since we've checked for booleans above, this is safe.
    const conditions = cleaned as Array<Condition<any>>;
    // This could result in duplicates entries for the same condition.
    // An optimization would be to de-dupe those.
    return mergeConditions(...conditions);
  }

  private async determinePowers(grants: Grants) {
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
      pushPower(res.name);

      const implementations = await this.resourcesHost.getImplementations(res);
      for (const implementation of implementations) {
        if (grants.has(implementation)) {
          // If policy specifies this implementation then defer to its entry.
          continue;
        }
        pushPower(implementation.name);
      }
    }
    return powers;
  }
}
