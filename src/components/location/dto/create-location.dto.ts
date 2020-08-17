import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField, NameField, Sensitivity } from '../../../common';
import {
  Country,
  PrivateLocation,
  PublicLocation,
  Region,
  Zone,
} from './location.dto';
import { PrivateLocationType } from './private-location-type.enum';

@InputType()
export abstract class CreateZone {
  @NameField()
  readonly name: string;

  @IdField({
    description: 'A user ID that will be the director of the zone',
  })
  readonly directorId: string;
}

@InputType()
export abstract class CreateRegion {
  @NameField()
  readonly name: string;

  @IdField({
    description: 'The zone ID that the region will be associated with',
  })
  readonly zoneId: string;

  @IdField({
    description: 'A user ID that will be the director of the region',
  })
  readonly directorId: string;
}

@InputType()
export abstract class CreateCountry {
  @NameField()
  readonly name: string;

  @IdField()
  readonly regionId: string;
}

@InputType()
export abstract class CreatePrivateLocation {
  @NameField()
  readonly name: string;

  @NameField()
  readonly publicName: string;

  @Field(() => Sensitivity, { nullable: true })
  readonly sensitivity?: Sensitivity;

  @Field(() => PrivateLocationType)
  readonly type: PrivateLocationType;
}

@InputType()
export abstract class CreatePublicLocation {
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
export abstract class CreateZoneInput {
  @Field()
  @Type(() => CreateZone)
  @ValidateNested()
  readonly zone: CreateZone;
}

@InputType()
export abstract class CreateRegionInput {
  @Field()
  @Type(() => CreateRegion)
  @ValidateNested()
  readonly region: CreateRegion;
}

@InputType()
export abstract class CreateCountryInput {
  @Field()
  @Type(() => CreateCountry)
  @ValidateNested()
  readonly country: CreateCountry;
}

@InputType()
export abstract class CreatePrivateLocationInput {
  @Field()
  @Type(() => CreatePrivateLocation)
  @ValidateNested()
  readonly privateLocation: CreatePrivateLocation;
}

@InputType()
export abstract class CreatePublicLocationInput {
  @Field()
  @Type(() => CreatePublicLocation)
  @ValidateNested()
  readonly publicLocation: CreatePublicLocation;
}

@ObjectType()
export abstract class CreateZoneOutput {
  @Field()
  readonly zone: Zone;
}

@ObjectType()
export abstract class CreateRegionOutput {
  @Field()
  readonly region: Region;
}

@ObjectType()
export abstract class CreateCountryOutput {
  @Field()
  readonly country: Country;
}

@ObjectType()
export abstract class CreatePrivateLocationOutput {
  @Field()
  readonly privateLocation: PrivateLocation;
}

@ObjectType()
export abstract class CreatePublicLocationOutput {
  @Field()
  readonly publicLocation: PublicLocation;
}
