import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { type Secured } from '~/common';
import { ResourceLoader } from '~/core/resources';
import { type ProducibleRef, SecuredProducible } from './dto';

@Resolver(SecuredProducible)
export class ProducibleResolver {
  constructor(private readonly resources: ResourceLoader) {}

  @ResolveField()
  async value(@Parent() secured: Secured<ProducibleRef>) {
    const producible = secured.value;
    if (!secured.canRead || !producible) {
      return null;
    }
    return await this.resources.loadByRef(producible);
  }
}
