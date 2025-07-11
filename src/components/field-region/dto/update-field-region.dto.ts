import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type ID, IdField, NameField } from '~/common';
import { FieldRegion } from './field-region.dto';

@InputType()
export abstract class UpdateFieldRegion {
  @IdField()
  readonly id: ID;

  @NameField({ optional: true })
  readonly name?: string;

  @IdField({
    description: 'The zone ID that the region will be associated with',
    optional: true,
  })
  readonly fieldZoneId?: ID;

  @IdField({
    description: 'A user ID that will be the director of the region',
    optional: true,
  })
  readonly directorId?: ID;
}

@InputType()
export abstract class UpdateFieldRegionInput {
  @Field()
  @Type(() => UpdateFieldRegion)
  @ValidateNested()
  readonly fieldRegion: UpdateFieldRegion;
}

@ObjectType()
export abstract class UpdateFieldRegionOutput {
  @Field()
  readonly fieldRegion: FieldRegion;
}
