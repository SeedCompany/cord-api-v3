import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { InputException, ListArg } from '~/common';
import {
  DeleteWebhookArgs,
  WebhookConfig,
  WebhookList,
  WebhookListInput,
  WebhookSaved,
  WebhooksDeleted,
  WebhookSecretRotated,
} from './dto';
import { WebhookManagementService } from './webhook-management.service';

@Resolver()
export class WebhookManagementResolver {
  constructor(private readonly service: WebhookManagementService) {}

  @Mutation(() => WebhookSaved)
  async saveWebhook(
    @Args('input') input: WebhookConfig,
  ): Promise<WebhookSaved> {
    const webhook = await this.service.save(input);
    return { webhook };
  }

  @Mutation(() => WebhookSecretRotated, {
    description: "Rotate the secret used for all of the user's webhooks",
  })
  async rotateWebhookSecret(): Promise<WebhookSecretRotated> {
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
    args: DeleteWebhookArgs,
  ): Promise<WebhooksDeleted> {
    if (Object.values(args).filter((v) => v !== undefined).length > 1) {
      throw new InputException(
        'Only one filter may be provided at a time to delete webhooks',
      );
    }
    const { id, key, name, all } = args;
    const filters = id ? { id } : key ? { key } : name ? { name } : null;
    if (!filters && !all) {
      return { deleted: [] };
    }
    const deleted = await this.service.deleteBy(filters ?? {});
    return { deleted };
  }
}
