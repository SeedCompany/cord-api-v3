import { Float, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { Dimensions } from './media.dto';

@Resolver(() => Dimensions)
export class DimensionsResolver {
  @ResolveField(() => Float, {
    description: 'Shortcut for `width / height`',
  })
  aspectRatio(@Parent() { width, height }: Dimensions) {
    return height ? width / height : 0;
  }
}
