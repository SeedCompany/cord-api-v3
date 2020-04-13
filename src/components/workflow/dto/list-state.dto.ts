import { Field, ObjectType } from 'type-graphql';
import { State } from './state.dto';

@ObjectType()
export class StateListOutput {
  @Field(() => [State])
  readonly items: State[];
}
