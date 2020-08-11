import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField } from '../../../common';
import { PublicLocation } from './public-location.dto';

@InputType()
export abstract class CreatePublicLocation {
  @IdField()
  readonly fieldRegionId: string;

  @IdField()
  readonly marketingLocationId: string;

  @IdField()
  readonly privateLocationId: string;

  @IdField({ nullable: true })
  readonly registryOfGeographyId?: string;

  @IdField({ nullable: true })
  readonly fundingAccountId?: string;
}

@InputType()
export abstract class CreatePublicLocationInput {
  @Field()
  @Type(() => CreatePublicLocation)
  @ValidateNested()
  readonly publicLocation: CreatePublicLocation;
}

@ObjectType()
export abstract class CreatePublicLocationOutput {
  @Field()
  readonly publicLocation: PublicLocation;
}
