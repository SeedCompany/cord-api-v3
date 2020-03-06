import { DateTime } from 'luxon';
import { Field, InputType } from 'type-graphql';
import { DateField } from '../../../common';
import { CeremonyType } from './type.enum';

@InputType()
export abstract class CreateCeremony {
  @Field(() => CeremonyType)
  readonly type: CeremonyType;

  @Field({ nullable: true })
  readonly planned?: boolean;

  @DateField({ nullable: true })
  readonly estimatedDate?: DateTime;

  @DateField({ nullable: true })
  readonly actualDate?: DateTime;
}
