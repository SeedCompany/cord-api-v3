import {
  DiscoveredClassWithMeta,
  DiscoveryService,
} from '@golevelup/nestjs-discovery';
import { Injectable, OnModuleInit } from '@nestjs/common';
import { pick, startCase } from 'lodash';
import { DeepWritable, Writable } from 'ts-essentials';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  EnhancedRelation,
  EnhancedResource,
  many,
  mapFromList,
} from '~/common';
import { ResourcesHost } from '~/core/resources';
import { Powers as Power } from '../dto/powers';
import { Role } from '../dto/role.dto';
import { ChildListAction, ChildSingleAction } from './actions';
import { Permission, Permissions } from './builder/perm-granter';
import {
  POLICY_METADATA_KEY,
  PolicyMetadata,
} from './builder/policy.decorator';
import {
  ResourceGranterImpl,
  ResourcesGranter,
} from './builder/resource-granter';
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
    const resGranter = ResourceGranterImpl.create(ResourceMap);

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
      const { resource, perms, props, childRelationships } = (
        resourceGrant as ResourceGranterImpl<any>
      ).extract();
      if (!grants.has(resource)) {
        grants.set(resource, {
          objectLevel: {},
          propLevel: {},
          childRelations: {},
        });
      }
      const { objectLevel, propLevel, childRelations } = grants.get(resource)!;
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
    }

    await this.defaultImplementationsFromInterfaces(grants);
    await this.defaultRelationEdgesToResourceLevel(grants);

    const powers = await this.determinePowers(grants);

    const name = startCase(discoveredClass.name.replace(/Policy$/, ''));
    const policy: Policy = { name, roles, grants, powers };
    this.attachPolicyToConditions(policy);

    return policy;
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
    for (const [resource, perms] of grants.entries()) {
      const impls = await this.resourcesHost.getImplementations(resource);
      for (const impl of impls) {
        if (!grants.has(impl)) {
          // If policy doesn't specify this implementation then use interface grant
          grants.set(impl, perms);
        }
      }
    }
  }

  private async defaultRelationEdgesToResourceLevel(grants: WritableGrants) {
    for (const [resource, { childRelations }] of grants.entries()) {
      for (const rel of resource.relations.values()) {
        if (childRelations[rel.name]) {
          continue; // already defined
        }
        const childActions =
          await this.determineRelationActionPermissionsFromResourceLevel(
            grants,
            rel
          );
        if (!childActions) {
          continue;
        }
        // Is merge necessary? We already know missing right?
        const childPerms = (childRelations[rel.name] ??= {});
        this.mergePermissions(childPerms, childActions);
      }
    }
  }

  private async determineRelationActionPermissionsFromResourceLevel(
    grants: Grants,
    rel: EnhancedRelation<any>
  ) {
    const type = rel.resource;
    if (!type) {
      // We shouldn't be here if this type is not referencing another
      // resource, so this is a safety/type check.
      return undefined;
    }

    const childActions = rel.list
      ? keysOf<Record<ChildListAction, any>>()
      : keysOf<Record<ChildSingleAction, any>>();

    if (grants.has(type)) {
      const { objectLevel } = grants.get(type)!;
      return pick(objectLevel, childActions);
    }

    const impls = await this.resourcesHost.getImplementations(type);

    // If not an interface or policy doesn't specify all implementations of interface.
    if (!(impls.length > 0 && impls.every((impl) => grants.has(impl)))) {
      return undefined;
    }

    // Otherwise take the least permissive intersection of all the implementations.
    return mapFromList(childActions, (action) => {
      const implActions = impls.map(
        (impl) => grants.get(impl)!.objectLevel[action]
      );
      const perm = this.intersectPermission(...implActions);
      return perm ? [action, perm] : null;
    });
  }

  private mergePermissions<TAction extends string>(
    existing: Writable<Permissions<TAction>>,
    toMerge: Permissions<TAction>
  ) {
    for (const [action, perm] of Object.entries(toMerge) as Array<
      [TAction, Permission | true]
    >) {
      existing[action] = this.unionPermission(perm, existing[action]);
    }
    return existing;
  }

  private unionPermission(
    ...perms: Array<Permission | undefined>
  ): Permission | undefined {
    const cleaned = perms.filter((p): p is Permission => !!p);
    if (cleaned.length === 0) {
      return undefined;
    }
    if (perms.some((perm) => perm === true)) {
      return true;
    }
    if (perms.length === 1) {
      return perms[0];
    }
    const conditions = cleaned.filter((p): p is Condition<any> => p !== true);
    // This could result in duplicates entries for the same condition.
    // An optimization would be to de-dupe those.
    return any(...conditions);
  }

  private intersectPermission(
    ...perms: Array<Permission | undefined>
  ): Permission | undefined {
    const cleaned = perms.filter((p): p is Permission => !!p);
    if (cleaned.length === 0) {
      return undefined;
    }
    if (cleaned.every((perm) => perm === true)) {
      return true;
    }
    const conditions = cleaned.filter((p): p is Condition<any> => p !== true);
    // This could result in duplicates entries for the same condition.
    // An optimization would be to de-dupe those.
    return all(...conditions);
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
