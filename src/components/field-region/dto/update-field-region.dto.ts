import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { IdField, NameField } from '../../../common';
import { FieldRegion } from './field-region.dto';

@InputType()
export abstract class UpdateFieldRegion {
  @IdField()
  readonly id: string;

  @NameField({ nullable: true })
  readonly name?: string;

  @IdField({
    description: 'The zone ID that the region will be associated with',
    nullable: true,
  })
  readonly fieldZoneId?: string;

  @IdField({
    description: 'A user ID that will be the director of the region',
    nullable: true,
  })
  readonly directorId?: string;
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
