import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { type CalendarDate, DateField, type ID, IdField } from '~/common';
import { Ceremony } from './ceremony.dto';

@InputType()
export abstract class UpdateCeremony {
  @IdField()
  readonly id: ID;

  @Field({ nullable: true })
  readonly planned?: boolean;

  @DateField({ nullable: true })
  readonly estimatedDate?: CalendarDate | null;

  @DateField({ nullable: true })
  readonly actualDate?: CalendarDate | null;
}

@InputType()
export abstract class UpdateCeremonyInput {
  @Field()
  @Type(() => UpdateCeremony)
  @ValidateNested()
  readonly ceremony: UpdateCeremony;
}

@ObjectType()
export abstract class UpdateCeremonyOutput {
  @Field()
  readonly ceremony: Ceremony;
}
