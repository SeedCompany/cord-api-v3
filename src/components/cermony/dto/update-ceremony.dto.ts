import { Type } from 'class-transformer';
import { ValidateNested } from 'class-validator';
import { DateTime } from 'luxon';
import { Field, ID, InputType, ObjectType } from 'type-graphql';
import { DateField } from '../../../common';
import { Ceremony } from './ceremony.dto';

@InputType()
export abstract class UpdateCeremony {
  @Field(() => ID)
  readonly id: string;

  @Field({ nullable: true })
  readonly planned?: boolean;

  @DateField({ nullable: true })
  readonly estimatedDate?: DateTime;

  @DateField({ nullable: true })
  readonly actualDate?: DateTime;
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
