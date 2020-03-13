import { Field, ObjectType } from '@nestjs/graphql';
import { State } from './state.dto';

@ObjectType()
export class StateListOutput {
  @Field(() => [State])
  readonly items: State[];
}
