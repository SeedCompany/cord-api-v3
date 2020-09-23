import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { NameField } from '../../../common';
import { MarketingLocation } from './marketing-location.dto';

@InputType()
export abstract class UpdateMarketingLocation {
  @Field(() => ID)
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;
}

@InputType()
export abstract class UpdateMarketingLocationInput {
  @Field()
  @Type(() => UpdateMarketingLocation)
  @ValidateNested()
  readonly marketingLocation: UpdateMarketingLocation;
}

@ObjectType()
export abstract class UpdateMarketingLocationOutput {
  @Field()
  readonly marketingLocation: MarketingLocation;
}
