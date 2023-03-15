import { Field, InputType } from '@nestjs/graphql';
import { ID, IdField } from '~/common';

@InputType({
  isAbstract: true,
})
export class CreateOutcomeInput {
  @IdField()
  report: ID;

  @Field()
  description: string;
}
