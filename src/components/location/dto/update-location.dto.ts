/* eslint-disable @typescript-eslint/naming-convention */
import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, ISO31661Alpha3, NameField } from '../../../common';
import { Transform } from '../../../common/transform.decorator';
import { LocationType } from './location-type.enum';
import { Location } from './location.dto';

@InputType()
export abstract class UpdateLocation {
  static readonly TablesToDto = {
    name: 'name',
    type: 'type',
    iso_alpha_3: 'isoAlpha3',
    funding_account: 'fundingAccountId',
    default_region: 'defaultFieldRegionId',
  };

  @IdField()
  readonly id: ID;

  @NameField({ nullable: true })
  readonly name?: string;

  @Field(() => LocationType, { nullable: true })
  readonly type: LocationType;

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
