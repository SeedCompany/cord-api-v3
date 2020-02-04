import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { Region, Country, Zone } from './location.dto';

@InputType()
export abstract class UpdateZone {
  @Field(() => ID)
  readonly id: string;

  @Field({ nullable: true })
  @MinLength(2)
  readonly name?: string;

  @Field(() => ID, {
    description: 'A user ID that will be the new director of the zone',
    nullable: true,
  })
  readonly directorId?: string;
}

@InputType()
export abstract class UpdateRegion {
  @Field(() => ID)
  readonly id: string;

  @Field({ nullable: true })
  @MinLength(2)
  readonly name?: string;

  @Field(() => ID, {
    description: 'The zone ID that the region will be associated with',
    nullable: true,
  })
  readonly zoneId?: string;

  @Field(() => ID, {
    description: 'A user ID that will be the director of the region',
    nullable: true,
  })
  readonly directorId?: string;
}

@InputType()
export abstract class UpdateCountry {
  @Field(() => ID)
  readonly id: string;

  @Field({ nullable: true })
  @MinLength(2)
  readonly name?: string;

  @Field(() => ID, {
    nullable: true,
  })
  readonly areaId?: string;
}

@InputType()
export abstract class UpdateZoneInput {
  @Field()
  @Type(() => UpdateZone)
  @ValidateNested()
  readonly zone: UpdateZone;
}

@InputType()
export abstract class UpdateRegionInput {
  @Field()
  @Type(() => UpdateRegion)
  @ValidateNested()
  readonly region: UpdateRegion;
}

@InputType()
export abstract class UpdateCountryInput {
  @Field()
  @Type(() => UpdateCountry)
  @ValidateNested()
  readonly country: UpdateCountry;
}

@ObjectType()
export abstract class UpdateZoneOutput {
  @Field()
  readonly zone: Zone;
}

@ObjectType()
export abstract class UpdateRegionOutput {
  @Field()
  readonly region: Region;
}

@ObjectType()
export abstract class UpdateCountryOutput {
  @Field()
  readonly country: Country;
}
