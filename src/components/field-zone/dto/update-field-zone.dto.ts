import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { type ID, IdField, NameField } from '~/common';
import { FieldZone } from './field-zone.dto';

@InputType()
export abstract class UpdateFieldZone {
  @IdField()
  readonly id: ID;

  @NameField({ optional: true })
  readonly name?: string;

  @IdField({
    description: 'A user ID that will be the director of the zone',
    optional: true,
  })
  readonly director?: ID<'User'>;
}

@ObjectType()
export abstract class FieldZoneUpdated {
  @Field()
  readonly fieldZone: FieldZone;
}
