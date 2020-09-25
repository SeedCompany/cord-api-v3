import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField, NameField, Sensitivity } from '../../../common';
import { LocationType } from './location-type.enum';

@InputType()
export abstract class CreateLocation {
  @NameField()
  readonly name: string;

  @Field(() => LocationType)
  readonly type: LocationType;

  @Field(() => Sensitivity)
  readonly sensitivity: Sensitivity;

  @Field({ nullable: true })
  readonly iso31663?: string;

  @NameField({ nullable: true })
  readonly geographyName?: string;

  @IdField({ nullable: true })
  readonly fundingAccountId?: string;
}

@InputType()
export abstract class CreateLocationInput {
  @Field()
  @Type(() => CreateLocation)
  @ValidateNested()
  readonly location: CreateLocation;
}

@ObjectType()
export abstract class CreateLocationOutput {
  @Field()
  readonly location: Location;
}
