import { Field, InputType } from '@nestjs/graphql';
import { ID, IdField, PickType } from '../../../common';
import { CreateDefinedFileVersionInput } from '../../file';

@InputType()
export class CreateQuestionAnswer {
  @IdField()
  readonly parentId: ID;

  @Field()
  readonly question: string;

  @Field({
    description: 'An optional category for the question given',
    nullable: true,
  })
  readonly category?: string;

  @Field(() => String, {
    nullable: true,
  })
  readonly answer?: string | null;

  @Field(() => [CreateDefinedFileVersionInput], {
    description: 'Optional files to help answer the question',
    nullable: true,
  })
  readonly media?: CreateDefinedFileVersionInput[];
}

@InputType()
export class UpdateQuestionAnswer extends PickType(CreateQuestionAnswer, [
  'answer',
  'media',
]) {
  @Field()
  readonly id: ID;
}
