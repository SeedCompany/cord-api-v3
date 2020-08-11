import { Field, ID, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../common';
import { PublicLocation } from './public-location.dto';

@InputType()
export abstract class UpdatePublicLocation {
  @Field(() => ID)
  readonly id: string;

  @IdField({ nullable: true })
  readonly fieldRegionId?: string;

  @IdField({ nullable: true })
  readonly marketingLocationId?: string;

  @IdField({ nullable: true })
  readonly privateLocationId?: string;

  @IdField({ nullable: true })
  readonly registryOfGeographyId?: string;

  @IdField({ nullable: true })
  readonly fundingAccountId?: string;
}

@InputType()
export abstract class UpdatePublicLocationInput {
  @Field()
  @Type(() => UpdatePublicLocation)
  @ValidateNested()
  readonly publicLocation: UpdatePublicLocation;
}

@ObjectType()
export abstract class UpdatePublicLocationOutput {
  @Field()
  readonly publicLocation: PublicLocation;
}
