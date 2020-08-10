import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { PrivateLocation } from './private-location.dto';

@InputType()
export abstract class UpdatePrivateLocation {
  @Field(() => ID)
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @NameField({ nullable: true })
  readonly publicName?: string;
}

@InputType()
export abstract class UpdatePrivateLocationInput {
  @Field()
  @Type(() => UpdatePrivateLocation)
  @ValidateNested()
  readonly privateLocation: UpdatePrivateLocation;
}

@ObjectType()
export abstract class UpdatePrivateLocationOutput {
  @Field()
  readonly privateLocation: PrivateLocation;
}
