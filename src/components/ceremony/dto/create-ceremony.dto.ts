import { Field, InputType } from '@nestjs/graphql';
import { CalendarDate, DateField } from '../../../common';
import { CeremonyType } from './ceremony-type.enum';

@InputType()
export abstract class CreateCeremony {
  @Field(() => CeremonyType)
  readonly type: CeremonyType;

  @Field({ nullable: true })
  readonly planned?: boolean;

  @DateField({ nullable: true })
  readonly estimatedDate?: CalendarDate;

  @DateField({ nullable: true })
  readonly actualDate?: CalendarDate;
}
