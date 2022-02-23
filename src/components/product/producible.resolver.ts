import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { AnonSession, Secured, Session } from '../../common';
import { ResourceResolver } from '../../core';
import { Producible, ProducibleRef, SecuredProducible } from './dto';

@Resolver(SecuredProducible)
export class ProducibleResolver {
  constructor(private readonly resources: ResourceResolver) {}

  @ResolveField(() => Producible, {
    nullable: true,
    description: stripIndent`
      The object that this product is producing.
      i.e. A film named "Jesus Film".
    `,
  })
  async value(
    @Parent() secured: Secured<ProducibleRef>,
    @AnonSession() session: Session
  ) {
    const producible = secured.value;
    if (!secured.canRead || !producible) {
      return null;
    }

    return await this.resources.lookup(
      producible.__typename,
      producible.id,
      session
    );
  }
}
