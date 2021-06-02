import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import { Resource, SecuredProps } from '../../../common';

@ObjectType({
  implements: [Resource],
})
export class ProductStep extends Resource {
  static readonly Props = keysOf<ProductStep>();
  static readonly SecuredProps = keysOf<SecuredProps<ProductStep>>();

  @Field()
  readonly name: string;

  @Field({
    nullable: true,
  })
  readonly progress: number;

  @Field({
    nullable: true,
  })
  readonly description: string;
}
