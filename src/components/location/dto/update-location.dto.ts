import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import {
  IdField,
  ISO31661Alpha3,
  NameField,
  Sensitivity,
} from '../../../common';
import { Transform } from '../../../common/transform.decorator';
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

  @Field(() => String, {
    nullable: true,
    description: 'An ISO 3166-1 alpha-3 country code',
  })
  @ISO31661Alpha3()
  @Transform((str) => (str ? str.toUpperCase() : null))
  readonly isoAlpha3?: string | null;

  @IdField({ nullable: true })
  readonly fundingAccountId?: string;

  @IdField({ nullable: true })
  readonly defaultFieldRegionId?: string;
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
