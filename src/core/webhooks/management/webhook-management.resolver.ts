import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { ListArg } from '~/common';
import {
  DeleteWebhookArgs,
  RotateWebhookSecretOutput,
  UpsertWebhookInput,
  UpsertWebhookOutput,
  WebhookList,
  WebhookListInput,
  WebhooksDeleted,
} from './dto';
import { WebhookManagementService } from './webhook-management.service';

@Resolver()
export class WebhookManagementResolver {
  constructor(private readonly service: WebhookManagementService) {}

  @Mutation(() => UpsertWebhookOutput)
  async upsertWebhook(
    @Args('input') input: UpsertWebhookInput,
  ): Promise<UpsertWebhookOutput> {
    const webhook = await this.service.upsert(input);
    return { webhook };
  }

  @Mutation(() => RotateWebhookSecretOutput, {
    description: "Rotate the secret used for all of the user's webhooks",
  })
  async rotateWebhookSecret(): Promise<RotateWebhookSecretOutput> {
    const next = await this.service.rotateSecret();
    return { secret: next };
  }

  @Query(() => WebhookList, {
    description: 'A list of registered webhooks for the requesting user',
  })
  async webhooks(
    @ListArg(WebhookListInput) input: WebhookListInput,
  ): Promise<WebhookList> {
    return await this.service.list(input);
  }

  @Mutation(() => WebhooksDeleted)
  async deleteWebhook(
    @Args({ type: () => DeleteWebhookArgs })
    { id, key, name, all }: DeleteWebhookArgs,
  ): Promise<WebhooksDeleted> {
    const filters = id ? { id } : key ? { key } : name ? { name } : null;
    if (!filters && !all) {
      return { deleted: [] };
    }
    const deleted = await this.service.deleteBy(filters ?? {});
    return { deleted };
  }
}
