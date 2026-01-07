import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { type ID, IdArg, ListArg } from '~/common';
import {
  DeleteWebhookOutput,
  RotateWebhookSecretOutput,
  UpsertWebhookInput,
  UpsertWebhookOutput,
  WebhookList,
  WebhookListInput,
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

  @Mutation(() => DeleteWebhookOutput)
  async deleteWebhook(
    @IdArg({ nullable: true }) id?: ID<'Webhook'>,
    @IdArg({ name: 'key', nullable: true }) key?: ID<'Webhook'>,
    @Args('name', { nullable: true }) name?: string,
  ): Promise<DeleteWebhookOutput> {
    if (id) {
      await this.service.deleteBy({ id });
    } else if (key) {
      await this.service.deleteBy({ key });
    } else if (name) {
      await this.service.deleteBy({ name });
    }
    return { success: true };
  }
}
