import { Field, ObjectType } from '@nestjs/graphql';
import { keys as keysOf } from 'ts-transformer-keys';
import {
  Resource,
  SecuredList,
  SecuredProps,
  SecuredStringNullable,
} from '../../../common';
import { SetChangeType } from '../../../core/database/changes';
import { BaseNode } from '../../../core/database/results';
import {
  CreateDefinedFileVersionInput,
  DefinedFile,
  SecuredDirectory,
} from '../../file';

@ObjectType()
export class QuestionAnswer extends Resource {
  static readonly Props = keysOf<QuestionAnswer>();
  static readonly SecuredProps = keysOf<SecuredProps<QuestionAnswer>>();
  /** The relationship name to parent node. Maybe this can be dynamic in future? */
  static readonly Rel = 'qna';

  readonly parent: BaseNode;

  @Field()
  readonly question: string;

  @Field({
    description: 'An optional category for the question given',
    nullable: true,
  })
  readonly category?: string;

  @Field()
  readonly answer: SecuredStringNullable;

  @Field(() => SecuredDirectory, {
    description: 'A spot to add files to help answer the question',
  })
  readonly media: DefinedFile &
    SetChangeType<'media', CreateDefinedFileVersionInput[] | undefined>;
}

@ObjectType({
  description: SecuredList.descriptionFor('question answer pair'),
})
export abstract class SecuredQuestionAnswerList extends SecuredList(
  QuestionAnswer
) {}
