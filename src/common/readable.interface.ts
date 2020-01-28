import { Field, InterfaceType } from 'type-graphql';

@InterfaceType({
  description: 'Entities that are readable',
})
export abstract class Readable {
  @Field({
    description: 'Whether the current user can read this object',
  })
  canRead: boolean;
}
