import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField, NameField } from '../../../common';
import { Country, Region, Zone } from './location.dto';

@InputType()
export abstract class UpdateZone {
  @IdField()
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @IdField({
    description: 'A user ID that will be the new director of the zone',
    nullable: true,
  })
  readonly directorId?: string;
}

@InputType()
export abstract class UpdateRegion {
  @IdField()
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @IdField({
    description: 'The zone ID that the region will be associated with',
    nullable: true,
  })
  readonly zoneId?: string;

  @IdField({
    description: 'A user ID that will be the director of the region',
    nullable: true,
  })
  readonly directorId?: string;
}

@InputType()
export abstract class UpdateCountry {
  @IdField()
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @IdField({ nullable: true })
  readonly regionId?: string;
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
