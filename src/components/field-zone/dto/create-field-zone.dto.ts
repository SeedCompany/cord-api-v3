import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type ID, IdField, NameField } from '~/common';
import { FieldZone } from './field-zone.dto';

@InputType()
export abstract class CreateFieldZone {
  @NameField()
  readonly name: string;

  @IdField({
    description: 'A user ID that will be the director of the field Zone',
  })
  readonly director: ID<'User'>;
}

@ObjectType()
export abstract class FieldZoneCreated {
  @Field()
  readonly fieldZone: FieldZone;
}
