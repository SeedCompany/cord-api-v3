import { SetMetadata } from '@nestjs/common';
import { Many } from '~/common';
import { Role } from '../../dto/role.dto';
import type { ResourceGranter, ResourcesGranter } from './resource-granter';

type ResourceGranterFn = (
  resourcesGranter: ResourcesGranter
) => Many<ResourceGranter<any>>;

export const POLICY_METADATA_KEY = Symbol('Policy');

export const Policy = (
  role: Many<Role> | 'all',
  privilegesForResources: ResourceGranterFn
): ClassDecorator =>
  SetMetadata<any, PolicyMetadata>(POLICY_METADATA_KEY, {
    role,
    def: privilegesForResources,
  });

export interface PolicyMetadata {
  role: Many<Role> | 'all';
  def: ResourceGranterFn;
}
