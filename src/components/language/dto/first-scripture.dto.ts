import { Field, InterfaceType, ObjectType } from '@nestjs/graphql';
import { has, ID, SecuredProperty } from '../../../common';

@InterfaceType({
  resolveType: (obj: FirstScripture) =>
    has('engagement', obj)
      ? InternalFirstScripture
      : obj.hasFirst
      ? ExternalFirstScripture
      : NoFirstScripture,
})
export abstract class FirstScripture {
  @Field({
    description: 'Whether any scripture exists',
  })
  hasFirst: boolean;
}

@ObjectType({
  implements: [FirstScripture],
  description:
    'First scripture that has been created but managed _outside_ of CORD. `hasFirst` will always be true.',
})
export abstract class ExternalFirstScripture extends FirstScripture {}

@ObjectType({
  implements: [FirstScripture],
  description:
    'First scripture that has been created and managed _in_ CORD. `hasFirst` will always be true.',
})
export abstract class InternalFirstScripture extends FirstScripture {
  engagement: ID;
}

@ObjectType({
  implements: [FirstScripture],
  description: 'Defined for completeness. `hasFirst` will always be false.',
})
export abstract class NoFirstScripture extends FirstScripture {}

@ObjectType({
  description: SecuredProperty.descriptionFor('first scripture'),
})
export class SecuredFirstScripture extends SecuredProperty(FirstScripture) {}
