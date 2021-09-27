import { Field, ObjectType } from '@nestjs/graphql';
import { NameField } from '../../../common';

@ObjectType()
export class QuestionBank {
  @Field(() => [QuestionBankCategory], {
    description: 'The categories of questions in this bank',
  })
  readonly categories: QuestionBankCategory[];
}

@ObjectType({
  description:
    'A specific category or grouping of questions in a question bank',
})
export class QuestionBankCategory {
  @NameField({
    description: 'The name of the category',
  })
  readonly name: string;

  @Field(() => [QuestionBankEntry], {
    description: 'Question entries within this category',
  })
  readonly entries: QuestionBankEntry[];

  @Field({
    description:
      'The minimum number of questions from this category that need to be answered',
    defaultValue: 0,
  })
  readonly minRequired?: number;
}

@ObjectType({
  description: 'A question within a question bank along with other attributes',
})
export class QuestionBankEntry {
  @Field({
    description: 'A question that someone should answer',
  })
  readonly question: string;

  @Field({
    description: 'Whether this is a required question to answer',
    defaultValue: false,
  })
  readonly required?: boolean;
}
