import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, IdOf, ISO31661Alpha3, NameField } from '../../../common';
import { Transform } from '../../../common/transform.decorator';
import { CreateDefinedFileVersionInput } from '../../file/dto';
import { LocationType } from './location-type.enum';
import { Location } from './location.dto';

@InputType()
export abstract class CreateLocation {
  @NameField()
  readonly name: string;

  @Field(() => LocationType)
  readonly type: LocationType;

  @Field(() => String, {
    nullable: true,
    description: 'An ISO 3166-1 alpha-3 country code',
  })
  @ISO31661Alpha3()
  @Transform(({ value: str }) => (str ? str.toUpperCase() : null))
  readonly isoAlpha3?: string | null;

  @IdField({ nullable: true })
  readonly fundingAccountId?: ID;

  @IdField({ nullable: true })
  readonly defaultFieldRegionId?: ID;

  @IdField({ nullable: true })
  readonly marketingRegionId?: IdOf<Location>;

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersionInput)
  @ValidateNested()
  readonly mapImage?: CreateDefinedFileVersionInput;
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
