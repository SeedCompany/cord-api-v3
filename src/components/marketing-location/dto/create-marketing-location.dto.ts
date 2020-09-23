import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { MarketingLocation } from './marketing-location.dto';

@InputType()
export abstract class CreateMarketingLocation {
  @NameField()
  readonly name: string;
}

@InputType()
export abstract class CreateMarketingLocationInput {
  @Field()
  @Type(() => CreateMarketingLocation)
  @ValidateNested()
  readonly marketingLocation: CreateMarketingLocation;
}

@ObjectType()
export abstract class CreateMarketingLocationOutput {
  @Field()
  readonly marketingLocation: MarketingLocation;
}
