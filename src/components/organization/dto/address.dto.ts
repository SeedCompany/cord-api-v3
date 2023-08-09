import { Field, ObjectType } from '@nestjs/graphql';
import { SecuredProperty } from '../../../common';

@ObjectType()
export abstract class Address {
  @Field()
  readonly addressOne: string;

  @Field()
  readonly addressTwo: string;

  @Field()
  readonly city: string;

  @Field()
  readonly state: string;

  @Field()
  readonly zip: string;

  @Field()
  readonly country: string;
}

@ObjectType({ description: 'an address' })
export class SecuredAddress extends SecuredProperty(Address) {}
