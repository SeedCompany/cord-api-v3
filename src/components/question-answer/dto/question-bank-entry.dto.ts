import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class QuestionBankEntry {
  @Field({
    description: 'A question that someone should answer',
  })
  readonly question: string;

  @Field({
    description: 'An optional category for the question given',
    nullable: true,
  })
  readonly category?: string;
}
