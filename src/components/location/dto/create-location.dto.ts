import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { Region, Country, Zone } from './location.dto';

@InputType()
export abstract class CreateZone {
  @Field()
  @MinLength(2)
  readonly name: string;

  @Field(() => ID, {
    description: 'A user ID that will be the director of the zone',
  })
  readonly directorId: string;
}

@InputType()
export abstract class CreateRegion {
  @Field()
  @MinLength(2)
  readonly name: string;

  @Field(() => ID, {
    description: 'The zone ID that the region will be associated with',
  })
  readonly zoneId: string;

  @Field(() => ID, {
    description: 'A user ID that will be the director of the region',
  })
  readonly directorId: string;
}

@InputType()
export abstract class CreateCountry {
  @Field()
  @MinLength(2)
  readonly name: string;

  @Field(() => ID)
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
