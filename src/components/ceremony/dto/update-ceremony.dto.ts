import { Field, InputType, ObjectType } from '@nestjs/graphql';
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

@ObjectType()
export abstract class CeremonyUpdated {
  @Field()
  readonly ceremony: Ceremony;
}
