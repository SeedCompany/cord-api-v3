import { ArgsType } from '@nestjs/graphql';
import { ID, IdField } from './id-field';

@ArgsType()
export class ReadPlanChangeArgs {
  @IdField()
  id: ID;

  @IdField({ nullable: true })
  changeset: ID;
}
