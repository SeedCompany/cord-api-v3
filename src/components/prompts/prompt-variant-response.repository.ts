import { Injectable } from '@nestjs/common';
import { ID, PaginatedListType, Session, TODO, UnsecuredDto } from '~/common';
import { DtoRepository } from '~/core';
import {
  ChangePrompt,
  ChoosePrompt,
  PromptVariantResponse,
  UpdatePromptVariantResponse,
} from './dto';

@Injectable()
export abstract class PromptVariantResponseRepository<
  TVariant extends string
> extends DtoRepository(PromptVariantResponse) {
  abstract list(
    parentId: ID,
    session: Session
  ): Promise<PaginatedListType<UnsecuredDto<PromptVariantResponse<TVariant>>>>;

  abstract create(
    input: ChoosePrompt,
    session: Session
  ): Promise<UnsecuredDto<PromptVariantResponse<TVariant>>>;

  abstract submitResponse(
    input: UpdatePromptVariantResponse<TVariant>,
    session: Session
  ): Promise<void>;

  async changePrompt(input: ChangePrompt, session: Session) {
    return TODO(input, session);
  }
}
