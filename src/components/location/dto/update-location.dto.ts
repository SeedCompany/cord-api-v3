import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  type ID,
  IdField,
  ISO31661Alpha3,
  NameField,
  OptionalField,
} from '~/common';
import { Transform } from '~/common/transform.decorator';
import { CreateDefinedFileVersionInput } from '../../file/dto';
import { LocationType } from './location-type.enum';
import { Location } from './location.dto';

@InputType()
export abstract class UpdateLocation {
  @IdField()
  readonly id: ID;

  @NameField({ optional: true })
  readonly name?: string;

  @OptionalField(() => LocationType)
  readonly type?: LocationType;

  @Field(() => String, {
    nullable: true,
    description: 'An ISO 3166-1 alpha-3 country code',
  })
  @ISO31661Alpha3()
  @Transform(({ value: str }) => (str ? str.toUpperCase() : null))
  readonly isoAlpha3?: string | null;

  @IdField({ nullable: true })
  readonly fundingAccountId?: ID | null;

  @IdField({ nullable: true })
  readonly defaultFieldRegionId?: ID | null;

  @IdField({ nullable: true })
  readonly defaultMarketingRegionId?: ID<Location> | null;

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly mapImage?: CreateDefinedFileVersionInput;
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
