import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, NameField } from '~/common';
import { FieldZone } from './field-zone.dto';

@InputType()
export abstract class CreateFieldZone {
  @NameField()
  readonly name: string;

  @IdField({
    description: 'A user ID that will be the director of the field Zone',
  })
  readonly directorId: ID;
}

@InputType()
export abstract class CreateFieldZoneInput {
  @Field()
  @Type(() => CreateFieldZone)
  @ValidateNested()
  readonly fieldZone: CreateFieldZone;
}

@ObjectType()
export abstract class CreateFieldZoneOutput {
  @Field()
  readonly fieldZone: FieldZone;
}
