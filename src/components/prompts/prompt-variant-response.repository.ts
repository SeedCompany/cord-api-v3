import { LazyGetter as Once } from 'lazy-get-decorator';
import {
  ChildListsKey,
  EnhancedResource,
  ID,
  PaginatedListType,
  ResourceShape,
  Session,
  TODO,
  UnsecuredDto,
} from '~/common';
import { DtoRepository } from '~/core';
import { privileges } from '~/core/database/dto.repository';
import { EdgePrivileges } from '../authorization';
import { ChildListAction } from '../authorization/policy/actions';
import {
  ChangePrompt,
  ChoosePrompt,
  PromptVariantResponse,
  UpdatePromptVariantResponse,
} from './dto';
import { VariantList, VariantOf } from './dto/variant.dto';

export const PromptVariantResponseRepository = <
  Parent extends ResourceShape<any>,
  TResourceStatic extends ResourceShape<PromptVariantResponse<TVariant>> & {
    Variants: VariantList<TVariant>;
  },
  TVariant extends string = VariantOf<TResourceStatic>
>(
  parentEdge: ListEdge<Parent>,
  resource: TResourceStatic
) => {
  abstract class PromptVariantResponseRepositoryClass extends DtoRepository<
    TResourceStatic,
    [Session]
  >(resource) {
    readonly resource: EnhancedResource<TResourceStatic>;

    @Once()
    get edge() {
      return this[privileges].forEdge(...parentEdge) as EdgePrivileges<
        Parent,
        any,
        ChildListAction
      >;
    }

    abstract list(
      parentId: ID,
      session: Session
    ): Promise<
      PaginatedListType<UnsecuredDto<PromptVariantResponse<TVariant>>>
    >;

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

  return PromptVariantResponseRepositoryClass;
};

export type ListEdge<TResourceStatic extends ResourceShape<any>> = [
  resource: TResourceStatic | EnhancedResource<TResourceStatic>,
  key: ChildListsKey<TResourceStatic>
];
