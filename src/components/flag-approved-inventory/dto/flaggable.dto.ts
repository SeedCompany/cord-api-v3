import { Field, InterfaceType } from '@nestjs/graphql';
import { ID, IdField } from '../../../common';

@InterfaceType({
  description: 'An item that can be flagged',
})
export class Flaggable {
  @IdField()
  readonly id: ID;

  @Field({
    description: 'Does the requesting user have this pinned?',
  })
  flagged: boolean;
}
