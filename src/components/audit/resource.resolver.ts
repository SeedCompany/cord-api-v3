import { Info, Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { stripIndent } from 'common-tags';
import { type GraphQLResolveInfo } from 'graphql';
import { ListArg, Resource } from '~/common';
import { AuditService } from './audit.service';
import {
  ResourceMutationList,
  ResourceMutationListInput,
} from './dto/resource-mutation.dto';

/**
 * Exposes the audit-log `history` field on EVERY resource by resolving it on
 * the base {@link Resource} interface — implementing object types inherit it,
 * so no per-domain resolver is needed. A domain's history is populated once its
 * service fires {@link import('./resource-mutated.hook').ResourceMutatedHook}.
 */
@Resolver(Resource)
export class ResourceHistoryResolver {
  constructor(private readonly audit: AuditService) {}

  @ResolveField(() => ResourceMutationList, {
    description: stripIndent`
      The audit-log history of mutations to this resource.

      An empty list means either this resource has not been mutated, or its
      type is not tracked in the audit log. Audit coverage spans user-driven
      mutations across most resources; some types (system-generated, sync-only,
      or relationship toggles) are intentionally not recorded.
    `,
  })
  async history(
    @Parent() resource: Resource,
    @Info() info: GraphQLResolveInfo,
    @ListArg(ResourceMutationListInput) input: ResourceMutationListInput,
  ): Promise<ResourceMutationList> {
    // `info.parentType.name` is the concrete GraphQL type GraphQL already
    // resolved this object to (e.g. MomentumTranslationProject), which is what
    // the firing service records under. NOT `resource.__typename` — for the
    // polymorphic interfaces (Engagement) that holds a Gel FQN like
    // 'default::LanguageEngagement', which wouldn't match the stored row.
    return await this.audit.list(info.parentType.name, resource.id, input);
  }
}
