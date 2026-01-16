import { Field, InputType, ObjectType } from '@nestjs/graphql';
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
  readonly fieldZone?: ID<'FieldZone'>;

  @IdField({
    description: 'A user ID that will be the director of the region',
    optional: true,
  })
  readonly director?: ID<'User'>;
}

@ObjectType()
export abstract class UpdateFieldRegionOutput {
  @Field()
  readonly fieldRegion: FieldRegion;
}
