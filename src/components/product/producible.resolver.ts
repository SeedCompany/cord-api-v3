import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { Secured } from '../../common';
import { ResourceLoader } from '../../core';
import { Producible, ProducibleRef, SecuredProducible } from './dto';

@Resolver(SecuredProducible)
export class ProducibleResolver {
  constructor(private readonly resources: ResourceLoader) {}

  @ResolveField(() => Producible, {
    nullable: true,
    description: stripIndent`
      The object that this product is producing.
      i.e. A film named "Jesus Film".
    `,
  })
  async value(@Parent() secured: Secured<ProducibleRef>) {
    const producible = secured.value;
    if (!secured.canRead || !producible) {
      return null;
    }
    return await this.resources.loadByRef(producible);
  }
}
