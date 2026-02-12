import { ObjectType } from '@nestjs/graphql';
import { Role } from '~/common/enums';
import { SecuredEnumList } from '../abstracts/secured-property';

@ObjectType({
  description: SecuredEnumList.descriptionFor('roles'),
})
export abstract class SecuredRoles extends SecuredEnumList(Role) {}
