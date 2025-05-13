import { ObjectType } from '@nestjs/graphql';
import {
  DbUnique,
  NameField,
  Resource,
  type Secured,
  SecuredProperty,
  SecuredPropertyList,
  SecuredString,
} from '~/common';
import { e } from '~/core/gel';
import { type LinkTo, RegisterResource } from '~/core/resources';

@RegisterResource({ db: e.FieldRegion })
@ObjectType({
  implements: [Resource],
})
export class FieldRegion extends Resource {
  @NameField()
  @DbUnique()
  readonly name: SecuredString;

  readonly fieldZone: Secured<LinkTo<'FieldZone'>>;

  readonly director: Secured<LinkTo<'User'>>;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('a field region'),
})
export class SecuredFieldRegion extends SecuredProperty(FieldRegion) {}

@ObjectType({
  description: SecuredPropertyList.descriptionFor('a list of field regions'),
})
export class SecuredFieldRegions extends SecuredPropertyList(FieldRegion) {}

declare module '~/core/resources/map' {
  interface ResourceMap {
    FieldRegion: typeof FieldRegion;
  }
  interface ResourceDBMap {
    FieldRegion: typeof e.default.FieldRegion;
  }
}
