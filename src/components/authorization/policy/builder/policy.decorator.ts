import { createMetadataDecorator } from '@seedcompany/nest';
import type { ValueOf } from 'type-fest';
import { type Many, type Role } from '~/common';
import type { ResourcesGranter } from '../granters';

type ResourceGranterFn = (
  resourcesGranter: ResourcesGranter,
) => Many<Many<ValueOf<ResourcesGranter>>>;

export const Policy = createMetadataDecorator({
  setter: (
    role: Many<Role> | 'all',
    privilegesForResources: ResourceGranterFn,
  ) => ({
    role,
    def: privilegesForResources,
  }),
  types: ['class'],
});
