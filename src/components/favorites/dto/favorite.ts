import { Field, ObjectType } from '@nestjs/graphql';
import { Resource, SecuredProperty } from '../../../common';

@ObjectType({
  implements: Resource,
})
export class Favorite {
  @Field()
  readonly baseNodeId: string;
}

@ObjectType({
  description: SecuredProperty.descriptionFor('an favorite'),
})
export class SecuredFavorite extends SecuredProperty(Favorite) {}
