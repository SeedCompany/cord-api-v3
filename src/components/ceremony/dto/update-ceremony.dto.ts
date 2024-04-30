import { Field, InputType, ObjectType } from '@nestjs/graphql';
import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { CalendarDate, DateField, ID, IdField } from '~/common';
import { Ceremony } from './ceremony.dto';

@InputType()
export abstract class UpdateCeremony {
  @IdField()
  readonly id: ID;

  @Field({ nullable: true })
  readonly planned?: boolean;

  @DateField({ nullable: true })
  readonly estimatedDate?: CalendarDate;

  @DateField({ nullable: true })
  readonly actualDate?: CalendarDate;
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
