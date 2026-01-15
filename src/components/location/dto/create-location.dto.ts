import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type ID, IdField, ISO31661Alpha3, NameField } from '~/common';
import { Transform } from '~/common/transform.decorator';
import { CreateDefinedFileVersion } from '../../file/dto';
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
  readonly fundingAccount?: ID<'FundingAccount'>;

  @IdField({ nullable: true })
  readonly defaultFieldRegion?: ID<'FieldRegion'>;

  @IdField({ nullable: true })
  readonly defaultMarketingRegion?: ID<Location>;

  @Field({ nullable: true })
  @Type(() => CreateDefinedFileVersion)
  @ValidateNested()
  readonly mapImage?: CreateDefinedFileVersion;
}

@ObjectType()
export abstract class CreateLocationOutput {
  @Field()
  readonly location: Location;
}
