import { Field, InterfaceType } from '@nestjs/graphql';

@InterfaceType({
  description: 'Entities that are editable',
})
export abstract class Editable {
  @Field({
    description: 'Whether the current user can edit this object',
  })
  canEdit: boolean;
}
