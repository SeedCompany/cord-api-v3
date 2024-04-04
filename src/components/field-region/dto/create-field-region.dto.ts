import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, NameField } from '~/common';
import { FieldRegion } from './field-region.dto';

@InputType()
export abstract class CreateFieldRegion {
  @NameField()
  readonly name: string;

  @IdField({
    description:
      'The field zone ID that the field region will be associated with',
  })
  readonly fieldZoneId: ID;

  @IdField({
    description: 'A user ID that will be the director of the field region',
  })
  readonly directorId: ID;
}

@InputType()
export abstract class CreateFieldRegionInput {
  @Field()
  @Type(() => CreateFieldRegion)
  @ValidateNested()
  readonly fieldRegion: CreateFieldRegion;
}

@ObjectType()
export abstract class CreateFieldRegionOutput {
  @Field()
  readonly fieldRegion: FieldRegion;
}
