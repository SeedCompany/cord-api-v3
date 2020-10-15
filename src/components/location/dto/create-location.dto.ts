import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { IsAlpha, Length, ValidateNested } from 'class-validator';
import { toUpper } from 'lodash';
import { IdField, NameField, Sensitivity } from '../../../common';
import { Transform } from '../../../common/transform.decorator';
import { LocationType } from './location-type.enum';
import { Location } from './location.dto';

@InputType()
export abstract class CreateLocation {
  @NameField()
  readonly name: string;

  @Field(() => LocationType)
  readonly type: LocationType;

  @Field(() => Sensitivity)
  readonly sensitivity: Sensitivity;

  @Field({ nullable: true, description: 'Must be 3 alpha characters' })
  @IsAlpha()
  @Length(3, 3)
  @Transform(toUpper)
  readonly isoAlpha3?: string;

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
