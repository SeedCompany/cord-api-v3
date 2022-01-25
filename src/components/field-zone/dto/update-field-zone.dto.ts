import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { ID, IdField, NameField } from '../../../common';
import { FieldZone } from './field-zone.dto';

@InputType()
export abstract class UpdateFieldZone {
  @IdField()
  readonly id: ID;

  @NameField({ nullable: true })
  readonly name?: string;

  @IdField({
    description: 'A user ID that will be the director of the zone',
    nullable: true,
  })
  readonly director?: ID;
}

@InputType()
export abstract class UpdateFieldZoneInput {
  @Field()
  @Type(() => UpdateFieldZone)
  @ValidateNested()
  readonly fieldZone: UpdateFieldZone;
}

@ObjectType()
export abstract class UpdateFieldZoneOutput {
  @Field()
  readonly fieldZone: FieldZone;
}
