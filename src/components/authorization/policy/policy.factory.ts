import {
  type DiscoveredClassWithMeta,
  DiscoveryService,
} from '@golevelup/nestjs-discovery';
import { Injectable, type OnModuleInit } from '@nestjs/common';
import { entries, mapEntries, mapValues, setOf } from '@seedcompany/common';
import { pick, startCase } from 'lodash';
import { type DeepWritable, type Writable } from 'ts-essentials';
import { type EnhancedResource, many, type Role } from '~/common';
import { ResourcesHost } from '~/core/resources';
import { Power } from '../dto';
import { ChildListAction, ChildSingleAction } from './actions';
import {
  extract,
  type Permission,
  type Permissions,
} from './builder/perm-granter';
import {
  POLICY_METADATA_KEY,
  type PolicyMetadata,
} from './builder/policy.decorator';
import { all, any, Condition } from './conditions';
import { type ResourcesGranter } from './granters';
import { GrantersFactory } from './granters.factory';

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
  roles?: ReadonlySet<Role>;
  /* What the policy grants */
  grants: Grants;
  /* An optimization to determine Powers this policy contains */
  powers: Set<Power>;
}

interface PlainPolicy extends Pick<Policy, 'name' | 'roles'> {
  grants: WritableGrants;
}

@Injectable()
export class PolicyFactory implements OnModuleInit {
  private policies?: Policy[];
  private dbPolicies?: Policy[];

  constructor(
    private readonly grantersFactory: GrantersFactory,
    private readonly discovery: DiscoveryService,
    private readonly resourcesHost: ResourcesHost,
  ) {}

  getPolicies() {
    if (!this.policies) {
      throw new Error('Policies are not available yet.');
    }
    return this.policies;
  }

  getDBPolicies() {
    if (!this.dbPolicies) {
      throw new Error('Policies are not available yet.');
    }
    return this.dbPolicies;
  }

  async onModuleInit() {
    const discoveredPolicies =
      await this.discovery.providersWithMetaAtKey<PolicyMetadata>(
        POLICY_METADATA_KEY,
      );

    const resGranter = await this.grantersFactory.makeGranters();

    const plainPolicies = discoveredPolicies.map((discovered) =>
      this.buildPlainPolicy(resGranter, discovered),
    );
    this.policies = plainPolicies.map((plain) => {
      const grants = cloneGrants(plain.grants);
      this.defaultInterfacesFromAllImplementationsIntersection(grants);
      this.defaultImplementationsFromInterfaces(grants);

      return this.enhancePolicy({ ...plain, grants });
    });
    this.dbPolicies = plainPolicies.map((plain) => {
      const grants = cloneGrants(plain.grants);
      this.stripImplementationsMatchingInterfaces(grants);

      return this.enhancePolicy({ ...plain, grants });
    });
  }

  private buildPlainPolicy(
    resGranter: ResourcesGranter,
    { meta, discoveredClass }: DiscoveredClassWithMeta<PolicyMetadata>,
  ): PlainPolicy {
    const name = startCase(discoveredClass.name.replace(/Policy$/, ''));

    const roles = meta.role === 'all' ? undefined : setOf(many(meta.role));

    const grants: WritableGrants = new Map();
    const resultList = many(meta.def(resGranter)).flat();
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
            this.mergePermissions(propPerms, perms),
          );
        }
      }
      for (const childRelation of childRelationships) {
        for (const relationName of childRelation.relationNames) {
          const childPerms = (childRelations[relationName] ??= {});
          childRelation.perms.forEach((perms) =>
            this.mergePermissions(childPerms, perms),
          );
        }
      }
    }

    return { name, roles, grants };
  }

  private enhancePolicy(plain: PlainPolicy): Policy {
    this.defaultRelationEdgesToResourceLevel(plain.grants);

    const powers = this.determinePowers(plain.grants);

    const policy: Policy = { ...plain, powers };
    this.attachPolicyToConditions(policy);

    return policy;
  }

  /**
   * Declare permissions of missing interfaces based on the intersection
   * its implementations
   */
  private defaultInterfacesFromAllImplementationsIntersection(
    grantMap: WritableGrants,
  ) {
    const interfaceCandidates = new Set(
      [...grantMap.keys()]
        .map((res) => this.resourcesHost.getInterfaces(res))
        .flat(),
    );

    const allKeysOf = (list: Array<object | undefined>) =>
      new Set(list.flatMap((itemObj) => (itemObj ? Object.keys(itemObj) : [])));

    const intersectPermissions = (
      perms: Array<Permissions<string> | undefined>,
    ): Permissions<string> =>
      mapEntries(allKeysOf(perms), (action, { SKIP }) => {
        const implActions = perms.map((g) => g?.[action] ?? false);
        const perm = this.mergePermission(implActions, all);
        return perm ? [action, perm] : SKIP;
      }).asRecord;

    for (const interfaceRes of interfaceCandidates) {
      // Skip if policy already defines
      if (grantMap.has(interfaceRes)) {
        continue;
      }

      const impls = this.resourcesHost.getImplementations(interfaceRes);

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
        propLevel: mapValues.fromList(allKeysOf(propLevelPermissions), (prop) =>
          intersectPermissions(
            propLevelPermissions.map((propLevel) => propLevel[prop]),
          ),
        ).asRecord,
        childRelations: mapValues.fromList(
          allKeysOf(childRelationPermissions),
          (prop) =>
            intersectPermissions(
              childRelationPermissions.map((propLevel) => propLevel[prop]),
            ),
        ).asRecord,
      };

      grantMap.set(interfaceRes, interfaceGrants);
    }
  }

  private stripImplementationsMatchingInterfaces(grantMap: WritableGrants) {
    const interfaceCandidates = new Set(
      [...grantMap.keys()]
        .map((res) => this.resourcesHost.getInterfaces(res))
        .flat(),
    );

    for (const interfaceRes of interfaceCandidates) {
      const interfaceGrants = grantMap.get(interfaceRes);
      // Skip if policy hasn't declared
      if (!interfaceCandidates) {
        continue;
      }

      const impls = this.resourcesHost.getImplementations(interfaceRes);

      for (const impl of impls) {
        const implGrants = grantMap.get(impl);
        if (!implGrants) {
          continue;
        }
        // Only bother checking object level read/create/delete as that is all our DB AP's use
        const isSame = entries(implGrants.objectLevel).every(
          ([action, perm]) => {
            if (action === 'edit') {
              return true;
            }
            const ifacePerm = interfaceGrants?.objectLevel[action];
            return (
              ifacePerm &&
              perm &&
              Condition.id(ifacePerm) === Condition.id(perm)
            );
          },
        );
        if (isSame) {
          grantMap.delete(impl);
        }
      }
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

  private defaultImplementationsFromInterfaces(grants: WritableGrants) {
    for (const resource of grants.keys()) {
      const impls = this.resourcesHost.getImplementations(resource);
      for (const impl of impls) {
        if (grants.has(impl)) {
          continue;
        }
        // If policy doesn't specify this implementation then use most specific
        // interface given.
        const interfaceToApply = this.resourcesHost
          .getInterfaces(impl)
          .find((i) => grants.has(i));
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

  private defaultRelationEdgesToResourceLevel(grants: WritableGrants) {
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

        const childActions = rel.list ? ChildListAction : ChildSingleAction;

        this.mergePermissions(
          (childRelations[rel.name] ??= {}),
          pick(grants.get(type)!.objectLevel, [...childActions]),
        );
      }
    }
  }

  private mergePermissions<TAction extends string>(
    existing: Writable<Permissions<TAction>>,
    toMerge: Permissions<TAction>,
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
    mergeConditions: (...conditions: Condition[]) => Condition,
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
    const conditions = cleaned as Condition[];
    // This could result in duplicates entries for the same condition.
    // An optimization would be to de-dupe those.
    return mergeConditions(...conditions);
  }

  private determinePowers(grants: Grants) {
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

      const implementations = this.resourcesHost.getImplementations(res);
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

const cloneGrants = (grants: Grants): WritableGrants =>
  new Map([
    ...mapValues(grants, (_, grant) => ({
      objectLevel: clonePermissions(grant.objectLevel),
      propLevel: mapValues(grant.propLevel, (_, perms) =>
        clonePermissions(perms),
      ).asRecord,
      childRelations: mapValues(grant.childRelations, (_, perms) =>
        clonePermissions(perms),
      ).asRecord,
    })),
  ]);

const clonePermissions = (permissions: Permissions<string>) =>
  mapEntries(permissions, (x) => x).asRecord;
