import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField, NameField } from '../../../common';
import { Country, Region, Zone } from './location.dto';

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
