import { ValueOf } from 'type-fest';
import { Session } from '../../../common';
import { ResourceMap } from '../../authorization/model/resource-map';
import { CreateQuestionAnswer } from '../dto';

type SomeResource = ValueOf<ResourceMap>['prototype'];

/**
 * Called when a question/answer is attempted to be created on an object.
 *
 * An event handler can mark this action as allowed by calling {@see markAllowed}.
 * An event handler can throw an `AuthorizationException` if this is not allowed.
 *
 * If no handler explicitly marks {@see markAllowed} then this action will be blocked
 * by default.
 */
export class AuthorizeQuestionAnswerCreationEvent {
  constructor(
    readonly parent: SomeResource & { __typename: string },
    readonly input: CreateQuestionAnswer,
    readonly session: Session
  ) {}

  get isAllowed() {
    return this.#allowed;
  }
  markAllowed() {
    this.#allowed = true;
  }
  #allowed = false;
}
