import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField, Sensitivity } from '../../../common';
import { PrivateLocationType } from './private-location-type.enum';
import { PrivateLocation } from './private-location.dto';

@InputType()
export abstract class CreatePrivateLocation {
  @NameField()
  readonly name: string;

  @NameField()
  readonly publicName: string;

  @Field(() => Sensitivity, { nullable: true })
  readonly sensitivity?: Sensitivity;

  @Field(() => PrivateLocationType)
  readonly type: PrivateLocationType;
}

@InputType()
export abstract class CreatePrivateLocationInput {
  @Field()
  @Type(() => CreatePrivateLocation)
  @ValidateNested()
  readonly privateLocation: CreatePrivateLocation;
}

@ObjectType()
export abstract class CreatePrivateLocationOutput {
  @Field()
  readonly privateLocation: PrivateLocation;
}
