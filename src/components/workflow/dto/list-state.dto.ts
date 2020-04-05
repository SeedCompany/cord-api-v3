import { ObjectType } from 'type-graphql';
import { PaginatedList } from '../../../common';
import { State } from './state.dto';

@ObjectType()
export class StateListOutput extends PaginatedList(State) {}
