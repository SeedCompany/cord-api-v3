import { Field, ObjectType } from '@nestjs/graphql';
import { SecuredList } from '~/common';
import { PromptList, VariantPromptList } from './prompt-list.dto';
import { PromptResponse, PromptVariantResponse } from './prompt-response.dto';

@ObjectType()
export class PromptResponseList extends SecuredList(PromptResponse) {
  @Field()
  readonly available: PromptList;
}

@ObjectType()
export class PromptVariantResponseList extends SecuredList(
  PromptVariantResponse
) {
  @Field()
  readonly available: VariantPromptList;
}
