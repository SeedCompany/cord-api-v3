import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnumList } from '~/common';

/**
 * The reach of the organization.
 */
export type OrganizationReach = EnumType<typeof OrganizationReach>;
export const OrganizationReach = makeEnum({
  name: 'OrganizationReach',
  description: 'The reach of the organization',
  values: ['Local', 'Regional', 'National', 'Global'],
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('organization reach'),
})
export class SecuredOrganizationReach extends SecuredEnumList(
  OrganizationReach,
) {}
