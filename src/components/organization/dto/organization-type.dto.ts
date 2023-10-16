import { ObjectType } from '@nestjs/graphql';
import { EnumType, makeEnum, SecuredEnumList } from '~/common';

/**
 * The type of organization.
 */
export type OrganizationType = EnumType<typeof OrganizationType>;
export const OrganizationType = makeEnum({
  name: 'OrganizationType',
  description: 'The type of organization',
  values: [
    'Church',
    'Parachurch',
    'Mission',
    'TranslationOrganization',
    'Alliance',
  ],
});

@ObjectType({
  description: SecuredEnumList.descriptionFor('organization types'),
})
export class SecuredOrganizationTypes extends SecuredEnumList(
  OrganizationType,
) {}
