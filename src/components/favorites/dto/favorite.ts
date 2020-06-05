import { Type } from '@nestjs/common';
import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredProperty } from '../../../common';

@ObjectType({
  implements: Resource,
})
export class Favorite {
  /* TS wants a public constructor for "ClassType" */
  static classType = (Favorite as any) as Type<Favorite>;

  @Field()
  readonly baseNodeId: string;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('an favorite'),
})
export class SecuredFavorite extends SecuredProperty(Favorite) {}
