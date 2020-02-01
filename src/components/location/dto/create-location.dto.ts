import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { Area, Country, Region } from './location.dto';

@InputType()
export abstract class CreateRegion {
  @Field()
  @MinLength(2)
  readonly name: string;

  @Field(() => ID, {
    description: 'A user ID that will be the director of the region',
  })
  readonly directorId: string;
}

@InputType()
export abstract class CreateArea {
  @Field()
  @MinLength(2)
  readonly name: string;

  @Field(() => ID, {
    description: 'The region ID that the area will be associated with',
  })
  readonly regionId: string;

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
  readonly areaId: string;
}

@InputType()
export abstract class CreateRegionInput {
  @Field()
  @Type(() => CreateRegion)
  @ValidateNested()
  readonly region: CreateRegion;
}

@InputType()
export abstract class CreateAreaInput {
  @Field()
  @Type(() => CreateArea)
  @ValidateNested()
  readonly area: CreateArea;
}

@InputType()
export abstract class CreateCountryInput {
  @Field()
  @Type(() => CreateCountry)
  @ValidateNested()
  readonly country: CreateCountry;
}

@ObjectType()
export abstract class CreateRegionOutput {
  @Field()
  readonly region: Region;
}

@ObjectType()
export abstract class CreateAreaOutput {
  @Field()
  readonly area: Area;
}

@ObjectType()
export abstract class CreateCountryOutput {
  @Field()
  readonly country: Country;
}
