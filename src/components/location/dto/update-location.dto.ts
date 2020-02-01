import { Type } from 'class-transformer';
import { MinLength, ValidateNested } from 'class-validator';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { Area, Country, Region } from './location.dto';

@InputType()
export abstract class UpdateRegion {
  @Field(() => ID)
  readonly id: string;

  @Field({ nullable: true })
  @MinLength(2)
  readonly name?: string;

  @Field(() => ID, {
    description: 'A user ID that will be the new director of the region',
    nullable: true,
  })
  readonly directorId?: string;
}

@InputType()
export abstract class UpdateArea {
  @Field(() => ID)
  readonly id: string;

  @Field({ nullable: true })
  @MinLength(2)
  readonly name?: string;

  @Field(() => ID, {
    description: 'The region ID that the area will be associated with',
    nullable: true,
  })
  readonly regionId?: string;

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
export abstract class UpdateRegionInput {
  @Field()
  @Type(() => UpdateRegion)
  @ValidateNested()
  readonly region: UpdateRegion;
}

@InputType()
export abstract class UpdateAreaInput {
  @Field()
  @Type(() => UpdateArea)
  @ValidateNested()
  readonly area: UpdateArea;
}

@InputType()
export abstract class UpdateCountryInput {
  @Field()
  @Type(() => UpdateCountry)
  @ValidateNested()
  readonly country: UpdateCountry;
}

@ObjectType()
export abstract class UpdateRegionOutput {
  @Field()
  readonly region: Region;
}

@ObjectType()
export abstract class UpdateAreaOutput {
  @Field()
  readonly area: Area;
}

@ObjectType()
export abstract class UpdateCountryOutput {
  @Field()
  readonly country: Country;
}
