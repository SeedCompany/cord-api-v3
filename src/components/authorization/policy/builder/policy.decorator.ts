import { SetMetadata } from '@nestjs/common';
import type { ValueOf } from 'type-fest';
import { type Many, type Role } from '~/common';
import type { ResourcesGranter } from '../granters';

type ResourceGranterFn = (
  resourcesGranter: ResourcesGranter,
) => Many<Many<ValueOf<ResourcesGranter>>>;

export const POLICY_METADATA_KEY = Symbol('Policy');

export const Policy = (
  role: Many<Role> | 'all',
  privilegesForResources: ResourceGranterFn,
): ClassDecorator =>
  SetMetadata<any, PolicyMetadata>(POLICY_METADATA_KEY, {
    role,
    def: privilegesForResources,
  });

export interface PolicyMetadata {
  role: Many<Role> | 'all';
  def: ResourceGranterFn;
}
