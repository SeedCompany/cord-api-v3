import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { FinanceDepartmentIdBlock } from './dto/id-blocks.dto';

@Resolver(() => FinanceDepartmentIdBlock)
export class IdBlockResolver {
  @ResolveField(() => String)
  blocks(@Parent() idBlock: FinanceDepartmentIdBlock) {
    return idBlock.blocks
      .map((range) => `${range.start}-${range.end}`)
      .join(', ');
  }
}
