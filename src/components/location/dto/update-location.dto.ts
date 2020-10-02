import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField, NameField, Sensitivity } from '../../../common';
import { LocationType } from './location-type.enum';
import { Location } from './location.dto';

@InputType()
export abstract class UpdateLocation {
  @IdField()
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @Field(() => LocationType, { nullable: true })
  readonly type: LocationType;

  @Field(() => Sensitivity, { nullable: true })
  readonly sensitivity?: Sensitivity;

  @Field({ nullable: true })
  readonly iso31663?: string;
}

@InputType()
export abstract class UpdateLocationInput {
  @Field()
  @Type(() => UpdateLocation)
  @ValidateNested()
  readonly location: UpdateLocation;
}

@ObjectType()
export abstract class UpdateLocationOutput {
  @Field()
  readonly location: Location;
}
