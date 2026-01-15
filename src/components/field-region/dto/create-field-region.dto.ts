import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type ID, IdField, NameField } from '~/common';
import { FieldRegion } from './field-region.dto';

@InputType()
export abstract class CreateFieldRegion {
  @NameField()
  readonly name: string;

  @IdField({
    description:
      'The field zone ID that the field region will be associated with',
  })
  readonly fieldZone: ID<'FieldZone'>;

  @IdField({
    description: 'A user ID that will be the director of the field region',
  })
  readonly director: ID<'User'>;
}

@ObjectType()
export abstract class CreateFieldRegionOutput {
  @Field()
  readonly fieldRegion: FieldRegion;
}
