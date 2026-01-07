import { ObjectType } from '@nestjs/graphql';
import { MutationPlaceholderOutput } from '~/common';

@ObjectType()
export class DeleteWebhookOutput extends MutationPlaceholderOutput {}
