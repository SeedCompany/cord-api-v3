import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Transform, Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  type ID,
  IdField,
  ISO31661Alpha3,
  NameField,
  OptionalField,
} from '~/common';
import { CreateDefinedFileVersion } from '../../file/dto';
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
  readonly fundingAccount?: ID<'FundingAccount'> | null;

  @IdField({ nullable: true })
  readonly defaultFieldRegion?: ID<'FieldRegion'> | null;

  @IdField({ nullable: true })
  readonly defaultMarketingRegion?: ID<Location> | null;

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly mapImage?: CreateDefinedFileVersion;
}

@ObjectType()
export abstract class LocationUpdated {
  @Field()
  readonly location: Location;
}
