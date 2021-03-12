import { Field, InterfaceType } from '@nestjs/graphql';

@InterfaceType({
  description: 'An item that can be pinned',
})
export class Pinnable {
  @Field({
    description: 'Does the requesting user have this pinned?',
  })
  pinned: boolean;
}
