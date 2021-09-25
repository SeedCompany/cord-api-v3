import { ID, Session, UnsecuredDto } from '../../../common';
import { ResourceMap } from '../../authorization/model/resource-map';
import { QuestionAnswer } from '../dto';

/**
 * Called when questions/answers need to be secured.
 *
 * An event handler should handle this by setting {@see secured} property.
 */
export class SecureQuestionAnswerEvent {
  secured?: QuestionAnswer;

  constructor(
    readonly dto: UnsecuredDto<QuestionAnswer>,
    readonly parent: { __typename: keyof ResourceMap; id: ID },
    readonly session: Session
  ) {}
}
